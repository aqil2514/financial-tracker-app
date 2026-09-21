import { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "./retailku-mcp-client";
import { syncCashflow } from "./sync-cashflow";
import { syncArAp } from "./sync-ar-ap";
import type { RetailkuCashflowSyncMode } from "./use-retailku-cashflow-sync-settings";

export type SyncAllInput = {
  mcpConfig: RetailkuMcpConfig;
  /** Akun kas lokal khusus untuk sisi AR/AP (transfer piutang/utang
   * baru) — TIDAK dipakai cashflow lagi sejak keputusan #2 revisi (tiap
   * akun kas Retailku sync ke akun lokalnya sendiri via
   * `retailku_account_mapping`, bukan satu akun gabungan). */
  arApCashAccountId: number;
  receivableDebtAccountId: number;
  payableDebtAccountId: number;
  dateFrom: string;
  dateTo: string;
  timezone: string;
  mode: RetailkuCashflowSyncMode;
};

export type SyncAllResult = {
  cashflowInsertedCount: number;
  cashflowUnmappedAccountIds: string[];
  arApInsertedCount: number;
};

/**
 * Titik masuk tunggal sinkronisasi Retailku — menjalankan cashflow DAN
 * AR/AP dalam SATU database transaction ALL-OR-NOTHING, lihat
 * docs/todos/plan/retailku-cashflow-sync.md bagian "Keterkaitan dengan
 * sync utang-piutang". Kalau salah satu gagal, SEMUANYA di-rollback —
 * tidak ada `source_ref` baru yang tersimpan sebagian.
 *
 * Data dari MCP Retailku sudah diambil lebih dulu oleh `syncCashflow`/
 * `syncArAp` masing-masing SEBELUM insert ke SQLite dimulai (bukan
 * ambil-insert-ambil-insert bergantian) — konsisten dengan keputusan
 * "SEMUA data dari MCP diambil dulu sebelum insert apa pun dimulai".
 *
 * `@tauri-apps/plugin-sql` TIDAK punya API transaction bawaan (cuma
 * `execute`/`select`), jadi BEGIN/COMMIT/ROLLBACK dijalankan sebagai raw
 * SQL manual di sini — SATU-SATUNYA tempat di codebase ini yang
 * melakukannya (operasi lain, mis. applyDebtTransaction, berurutan tanpa
 * wrapping karena sebelumnya tidak pernah butuh atomicity lintas-domain
 * seperti ini).
 */
export async function syncAll(input: SyncAllInput): Promise<SyncAllResult> {
  const db = await getDb();

  await db.execute("BEGIN");
  try {
    const cashflowResult = await syncCashflow(db, {
      mcpConfig: input.mcpConfig,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      mode: input.mode,
    });

    const arApResult = await syncArAp(db, {
      mcpConfig: input.mcpConfig,
      localCashAccountId: input.arApCashAccountId,
      receivableDebtAccountId: input.receivableDebtAccountId,
      payableDebtAccountId: input.payableDebtAccountId,
      today: input.dateTo,
    });

    await db.execute("COMMIT");

    return {
      cashflowInsertedCount: cashflowResult.insertedCount,
      cashflowUnmappedAccountIds: cashflowResult.unmappedAccountIds,
      arApInsertedCount: arApResult.insertedCount,
    };
  } catch (err) {
    await db.execute("ROLLBACK");
    throw err;
  }
}

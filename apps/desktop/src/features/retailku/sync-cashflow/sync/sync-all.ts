import { getDb } from "@/lib/db";
import type { RetailkuMcpConfig } from "@/shared/retailku";
import { syncCashflow, type SyncCashflowResult } from "./cashflow";
import { syncArAp, rollbackArApSnapshots, type SyncArApResult } from "./sync-ar-ap";
import type { RetailkuCashflowSyncMode } from "./use-retailku-cashflow-sync-settings";

type Db = Awaited<ReturnType<typeof getDb>>;

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
  cashflowUnmappedKeys: string[];
  cashflowDeactivatedPaymentMethodAccountIds: string[];
  arApInsertedCount: number;
};

// Lock in-memory MODUL-LEVEL (bukan per-komponen) — `syncAll` dipanggil
// dari DUA sumber independen yang tidak saling tahu satu sama lain:
// `useRetailkuAutoSync` (otomatis saat app dibuka) dan `useSyncRetailkuAll`
// (tombol "Sync Sekarang" manual). Tanpa lock ini, keduanya bisa berjalan
// BERSAMAAN (mis. user klik "Sync Sekarang" tepat saat auto-sync baru
// mulai) — masing-masing memanggil `computeCashflowSync` secara
// independen, membaca state "belum tersinkron" di titik yang sama
// (belum ada yang commit), lalu KEDUANYA insert baris dengan
// `source_ref` yang sama -> yang kedua gagal `UNIQUE constraint failed:
// transactions.source, transactions.source_ref` (bug ditemukan live,
// lihat handover 2026-09-23). `isPeriodSynced` di `sync-cashflow.ts`
// TIDAK cukup untuk mencegah ini karena dia cuma efektif ANTAR
// pemanggilan yang berurutan, bukan yang overlap secara konkuren.
let syncInFlight: Promise<SyncAllResult> | null = null;

/**
 * Titik masuk tunggal sinkronisasi Retailku — menjalankan cashflow DAN
 * AR/AP, lihat docs/todos/plan/retailku-cashflow-sync.md bagian
 * "Keterkaitan dengan sync utang-piutang".
 *
 * ALL-OR-NOTHING VIA ROLLBACK MANUAL, BUKAN BEGIN/COMMIT/ROLLBACK SQL
 * ASLI — `@tauri-apps/plugin-sql` memakai connection pool di balik
 * layar (tiap `execute()`/`select()` bisa jatuh ke koneksi fisik
 * berbeda), jadi BEGIN di satu panggilan dan INSERT berikutnya bisa
 * beda koneksi -> "database is locked" (dikonfirmasi TERJADI nyata saat
 * live testing, dan merupakan keterbatasan diketahui plugin ini —
 * lihat GitHub issue tauri-apps/plugins-workspace#886, belum ada fix
 * resmi per 2026-09). Solusinya: jalankan cashflow lalu AR/AP seperti
 * biasa (tanpa BEGIN/COMMIT), TANGKAP siapa saja yang berhasil di-insert
 * dari masing-masing (`insertedSourceRefs`/snapshot lama), dan kalau
 * SALAH SATU melempar error, DELETE manual semua yang sudah ter-insert
 * (termasuk dari jalur yang sudah sukses duluan) + restore snapshot
 * AR/AP — mensimulasikan rollback tanpa transaction SQL asli.
 *
 * PENTING: `debts.transaction_id` pakai `ON DELETE SET NULL` (bukan
 * CASCADE, lihat 0012_debts.sql) — DELETE `transactions` SAJA tidak
 * ikut menghapus `debts`/`debt_payments` terkait. Rollback HARUS hapus
 * `debts`/`debt_payments` dulu secara eksplisit sebelum `transactions`.
 *
 * Kalau ada sync lain sedang berjalan, panggilan ini MENUNGGU sync itu
 * selesai lebih dulu (bukan ditolak) — supaya baik auto-sync maupun
 * manual sync tetap dapat hasilnya sendiri-sendiri, cuma dijalankan
 * berurutan (serialized), bukan konkuren.
 */
export function syncAll(input: SyncAllInput): Promise<SyncAllResult> {
  // `previous` ditangkap SEBELUM `syncInFlight` ditimpa (masih sinkron,
  // tidak ada `await` di antaranya) supaya dua panggilan `syncAll()`
  // yang datang berdekatan tetap saling ber-chain dengan benar, bukan
  // sama-sama menunggu Promise yang sama lalu jalan bersamaan.
  const previous = syncInFlight;
  const result = (async () => {
    if (previous) await previous.catch(() => {});
    return syncAllInternal(input);
  })();

  syncInFlight = result.finally(() => {
    if (syncInFlight === result) syncInFlight = null;
  });
  return result;
}

async function syncAllInternal(input: SyncAllInput): Promise<SyncAllResult> {
  const db = await getDb();

  let cashflowResult: SyncCashflowResult | null = null;
  let arApResult: SyncArApResult | null = null;

  try {
    cashflowResult = await syncCashflow(db, {
      mcpConfig: input.mcpConfig,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      timezone: input.timezone,
      mode: input.mode,
    });

    arApResult = await syncArAp(db, {
      mcpConfig: input.mcpConfig,
      localCashAccountId: input.arApCashAccountId,
      receivableDebtAccountId: input.receivableDebtAccountId,
      payableDebtAccountId: input.payableDebtAccountId,
      today: input.dateTo,
    });

    return {
      cashflowInsertedCount: cashflowResult.insertedCount,
      cashflowUnmappedKeys: cashflowResult.unmappedKeys,
      cashflowDeactivatedPaymentMethodAccountIds: cashflowResult.deactivatedPaymentMethodAccountIds,
      arApInsertedCount: arApResult.insertedCount,
    };
  } catch (err) {
    await rollbackManually(db, cashflowResult, arApResult);
    throw err;
  }
}

async function rollbackManually(
  db: Db,
  cashflowResult: SyncCashflowResult | null,
  arApResult: SyncArApResult | null
): Promise<void> {
  const allSourceRefs = [
    ...(cashflowResult?.insertedSourceRefs ?? []),
    ...(arApResult?.insertedSourceRefs ?? []),
  ];
  if (allSourceRefs.length === 0 && arApResult == null) return;

  if (allSourceRefs.length > 0) {
    const placeholders = allSourceRefs.map((_, i) => `$${i + 1}`).join(", ");

    // debts.transaction_id pakai ON DELETE SET NULL — hapus debts/
    // debt_payments dulu secara eksplisit sebelum transactions, supaya
    // tidak ada baris debts "yatim" tersisa dari transaksi yang
    // dibatalkan. debt_payments punya ON DELETE CASCADE dari debts,
    // jadi cukup hapus debts, debt_payments ikut terhapus otomatis.
    await db.execute(
      `DELETE FROM debts WHERE transaction_id IN (
         SELECT id FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})
       )`,
      allSourceRefs
    );
    await db.execute(
      `DELETE FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})`,
      allSourceRefs
    );
  }

  if (arApResult != null) {
    await rollbackArApSnapshots(db, arApResult.touchedPartyIds, arApResult.previousSnapshotsById);
  }
}

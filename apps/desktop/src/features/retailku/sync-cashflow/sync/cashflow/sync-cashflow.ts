import { computeCashflowSync } from "./compute-cashflow-sync";
import { insertCashflowTransaction } from "./helpers/insert-cashflow-transaction";
import type { Db, SyncCashflowInput, SyncCashflowResult } from "./types";

/**
 * Sinkronisasi cashflow Retailku -> transaksi lokal, lihat
 * docs/todos/plan/retailku-cashflow-sync.md keputusan #1 (idempotency),
 * #2 REVISI (per akun kas Retailku sendiri-sendiri, BUKAN konvergen ke
 * satu akun lokal) dan #6 (mode ringkas/detail). SUMBER DATA SEKARANG
 * SELALU `get_cashflow_detail` (punya `accountId` per baris) — TIDAK
 * LAGI memakai `get_cashflow_summary` sama sekali, bahkan untuk mode
 * ringkas, karena tool itu tidak punya breakdown per akun.
 *
 * TIDAK dibungkus BEGIN/COMMIT SQL (lihat "Bug ditemukan live" di
 * retailku-cashflow-sync.md — @tauri-apps/plugin-sql tidak mendukung
 * itu dengan aman) — caller (`sync-all.ts`) melakukan rollback MANUAL
 * (DELETE) berdasar `insertedSourceRefs` yang dikembalikan di sini kalau
 * jalur lain gagal.
 *
 * Logic fetch+agregasi+cek mapping/idempotency ada di
 * `computeCashflowSync` — fungsi ini tinggal INSERT baris yang
 * `willInsert: true`.
 */
export async function syncCashflow(db: Db, input: SyncCashflowInput): Promise<SyncCashflowResult> {
  const plan = await computeCashflowSync(db, input);

  const insertedSourceRefs: string[] = [];
  for (const row of plan.rows) {
    if (!row.willInsert || row.localAccountId == null) continue;
    await insertCashflowTransaction(db, {
      accountId: row.localAccountId,
      amount: row.net,
      date: row.date,
      note: row.note,
      categoryId: row.categoryId,
      description: row.description,
      sourceRef: row.sourceRef,
    });
    insertedSourceRefs.push(row.sourceRef);
  }

  return {
    insertedCount: insertedSourceRefs.length,
    insertedSourceRefs,
    unmappedKeys: plan.unmappedKeys,
    deactivatedPaymentMethodAccountIds: plan.deactivatedPaymentMethodAccountIds,
  };
}

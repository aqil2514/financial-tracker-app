import type { ArApSyncPlanRow, Db } from "../types";

// row.willInsertPayments sudah dijamin terisi (all-or-nothing) oleh
// buildArApPlanRows — 1 baris CONSIGNMENT_SETTLEMENT melunasi BANYAK
// debts sekaligus, masing-masing dgn porsi amount-nya sendiri (sudah
// dari FIFO sisi Retailku, TIDAK dihitung ulang di sini). source_ref
// per alokasi HARUS unik (idx_debt_payments_source_ref) — row.sourceRef
// (journalItemId baris kas settlement) digabung `debtId` supaya tiap
// debt_payments dari satu settlement yang sama tetap punya source_ref
// berbeda. account_id NULL sengaja, sama seperti insertArApPayment.
export async function insertArApPaymentsBatch(db: Db, row: ArApSyncPlanRow): Promise<void> {
  for (const allocation of row.willInsertPayments) {
    await db.execute(
      `INSERT INTO debt_payments (debt_id, amount, account_id, date, source, source_ref)
       VALUES ($1, $2, NULL, $3, 'retailku_sync', $4)`,
      [allocation.debtId, allocation.amount, row.date, `${row.sourceRef}:${allocation.debtId}`]
    );
  }
}

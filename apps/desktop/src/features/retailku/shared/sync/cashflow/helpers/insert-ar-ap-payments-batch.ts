import type { ArApSyncPlanRow, Db } from "../types";

// row.willInsertPayments sudah dijamin terisi (all-or-nothing) oleh
// buildArApPlanRows — 1 baris CONSIGNMENT_SETTLEMENT melunasi BANYAK
// debts sekaligus, masing-masing dgn porsi amount-nya sendiri (sudah
// dari FIFO sisi Retailku, TIDAK dihitung ulang di sini). source_ref
// per alokasi HARUS unik (idx_debt_payments_source_ref) — row.sourceRef
// (journalItemId baris kas settlement) digabung `debtId` supaya tiap
// debt_payments dari satu settlement yang sama tetap punya source_ref
// berbeda. account_id = row.paymentAccountId, SAMA untuk semua alokasi
// (satu settlement, satu akun kas — split kas belum pernah terjadi di
// data nyata, lihat handover), bisa NULL kalau belum dipetakan.
export async function insertArApPaymentsBatch(db: Db, row: ArApSyncPlanRow): Promise<void> {
  for (const allocation of row.willInsertPayments) {
    await db.execute(
      `INSERT INTO debt_payments (debt_id, amount, account_id, date, source, source_ref)
       VALUES ($1, $2, $3, $4, 'retailku_sync', $5)`,
      [allocation.debtId, allocation.amount, row.paymentAccountId, row.date, `${row.sourceRef}:${allocation.debtId}`]
    );
  }
}

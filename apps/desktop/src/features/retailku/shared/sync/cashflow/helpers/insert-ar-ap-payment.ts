import type { ArApSyncPlanRow, Db } from "../types";

// row.willInsertPayment sudah dijamin true + paymentDebtId terisi oleh
// buildArApPlanRows. row.amount NEGATIF (piutang berkurang) — dibalik
// jadi positif di sini karena debt_payments.amount merepresentasikan
// besarnya cicilan, bukan arah perubahan piutang (lihat 0012_debts.sql).
// debts.amount (pokok) TIDAK disentuh, sisa dihitung on-read (pokok -
// SUM(debt_payments.amount)). account_id NULL sengaja — representasi
// akun kas mana yang menerima pelunasan (cashAccounts dari Retailku)
// belum digarap, konsisten dengan keputusan `cashAccounts` diabaikan
// utk baris piutang baru (lihat handover sesi 3).
export async function insertArApPayment(db: Db, row: ArApSyncPlanRow): Promise<void> {
  await db.execute(
    `INSERT INTO debt_payments (debt_id, amount, account_id, date, source, source_ref)
     VALUES ($1, $2, NULL, $3, 'retailku_sync', $4)`,
    [row.paymentDebtId, Math.abs(row.amount), row.date, row.sourceRef]
  );
}

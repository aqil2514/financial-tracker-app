import { newId } from "@/lib/id";
import type { ArApSyncPlanRow, Db } from "../types";

// row.willInsertPayment sudah dijamin true + paymentDebtId terisi oleh
// buildArApPlanRows. row.amount NEGATIF (piutang berkurang) — dibalik
// jadi positif di sini karena debt_payments.amount merepresentasikan
// besarnya cicilan, bukan arah perubahan piutang (lihat 0012_debts.sql).
// debts.amount (pokok) TIDAK disentuh, sisa dihitung on-read (pokok -
// SUM(debt_payments.amount)). account_id = row.paymentAccountId, bisa
// NULL kalau akun kas belum dipetakan atau split ke >1 akun kas (belum
// pernah terjadi di data nyata, lihat handover) — pelunasan tetap
// tercatat walau representasi kasnya kosong.
export async function insertArApPayment(db: Db, row: ArApSyncPlanRow): Promise<void> {
  await db.execute(
    `INSERT INTO debt_payments (id, debt_id, amount, account_id, date, source, source_ref)
     VALUES ($1, $2, $3, $4, $5, 'retailku_sync', $6)`,
    [newId(), row.paymentDebtId, Math.abs(row.amount), row.paymentAccountId, row.date, row.sourceRef]
  );
}

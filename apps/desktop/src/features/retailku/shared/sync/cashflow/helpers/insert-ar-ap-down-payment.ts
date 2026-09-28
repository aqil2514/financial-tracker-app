import { insertCashflowTransaction } from "./insert-cashflow-transaction";
import type { ArApSyncPlanRow, Db } from "../types";

// row.downPayment sudah dijamin non-null oleh buildArApPlanRows.
// Diinsert sebagai baris `transactions` BIASA (SAMA seperti cashflow
// biasa non-AR/AP) — debts.amount TETAP row.amount (piutang/utang
// SUDAH net setelah DP dikurangi, TIDAK disentuh di sini). source_ref
// diturunkan dari row.journalItemId (BUKAN row.sourceRef, yang dipakai
// debts) supaya tidak bentrok index unik & idempotent per journal item.
export async function insertArApDownPayment(db: Db, row: ArApSyncPlanRow): Promise<void> {
  if (row.downPayment == null) return;
  await insertCashflowTransaction(db, {
    accountId: row.downPayment.localAccountId,
    amount: row.downPayment.amount,
    date: row.date,
    note: row.downPayment.note,
    categoryId: row.downPayment.categoryId,
    description: row.downPayment.description,
    sourceRef: downPaymentSourceRef(row),
  });
}

export function downPaymentSourceRef(row: ArApSyncPlanRow): string {
  return `${row.journalItemId}:ar_ap_dp`;
}

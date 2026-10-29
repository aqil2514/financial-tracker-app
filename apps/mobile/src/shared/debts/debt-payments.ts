import type { Db } from "./types";

export type DebtPaymentRow = {
  id: string;
  debt_id: string;
  amount: number;
  account_id: string | null;
  account_name: string | null;
  transaction_id: string | null;
  note: string | null;
  date: string;
};

// Riwayat cicilan/pelunasan satu `debts` — dipakai di baris expandable
// halaman detail kontak maupun list flat Utang Piutang.
export async function getDebtPayments(db: Db, debtId: string): Promise<DebtPaymentRow[]> {
  return db.getAllAsync<DebtPaymentRow>(
    `SELECT
       debt_payments.id, debt_payments.debt_id, debt_payments.amount, debt_payments.account_id,
       accounts.name AS account_name, debt_payments.transaction_id, debt_payments.note, debt_payments.date
     FROM debt_payments
     LEFT JOIN accounts ON accounts.id = debt_payments.account_id
     WHERE debt_payments.debt_id = ?
     ORDER BY debt_payments.date DESC, debt_payments.id DESC`,
    [debtId]
  );
}

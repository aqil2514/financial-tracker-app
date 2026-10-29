import { remainingDebtSql } from "./remaining-debt-sql";
import type { Db } from "./types";

export type DebtListRow = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  contact_name: string | null;
  amount: number;
  account_id: string | null;
  account_name: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  remaining: number;
};

// List flat SEMUA debt (payable+receivable dicampur, bukan 2 halaman
// terpisah seperti desktop) untuk halaman Utang Piutang mobile — versi
// MVP tanpa filter/sort/period-picker/pagination (lihat
// docs/todos/plan/porting-account-debt.md bagian Keputusan).
export async function getDebtsList(db: Db): Promise<DebtListRow[]> {
  return db.getAllAsync<DebtListRow>(`
    SELECT
      debts.id, debts.type, debts.contact_id, contacts.name AS contact_name,
      debts.amount, debts.account_id, accounts.name AS account_name,
      debts.transaction_id, debts.status, debts.note, debts.date,
      ${remainingDebtSql()} AS remaining
    FROM debts
    LEFT JOIN contacts ON contacts.id = debts.contact_id
    LEFT JOIN accounts ON accounts.id = debts.account_id
    ORDER BY debts.date DESC, debts.id DESC
  `);
}

import { remainingDebtSql } from "./remaining-debt-sql";
import type { Db } from "./types";

export type ContactDebtRow = {
  id: string;
  type: "receivable" | "payable";
  contact_id: string | null;
  amount: number;
  account_id: string | null;
  account_name: string | null;
  transaction_id: string | null;
  status: "ongoing" | "paid" | "written_off";
  note: string | null;
  date: string;
  remaining: number;
};

// Semua debts (piutang DAN utang, SEMUA status) milik SATU kontak —
// dipakai halaman detail kontak, beda dari query list flat Utang
// Piutang yang difilter per type, bukan per kontak.
export async function getContactDebts(db: Db, contactId: string): Promise<ContactDebtRow[]> {
  return db.getAllAsync<ContactDebtRow>(
    `SELECT
       debts.id, debts.type, debts.contact_id, debts.amount, debts.account_id,
       accounts.name AS account_name, debts.transaction_id, debts.status, debts.note, debts.date,
       ${remainingDebtSql()} AS remaining
     FROM debts
     LEFT JOIN accounts ON accounts.id = debts.account_id
     WHERE debts.contact_id = ?
     ORDER BY debts.date DESC, debts.id DESC`,
    [contactId]
  );
}

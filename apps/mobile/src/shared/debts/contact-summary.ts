import { remainingDebtSql } from "./remaining-debt-sql";
import type { Db } from "./types";

export type ContactDebtSummary = {
  contact_id: string;
  contact_name: string;
  // Total POKOK piutang ONGOING milik kontak ini (sebelum dikurangi
  // cicilan yang sudah masuk). 0 kalau tidak ada piutang ongoing.
  receivable_active: number;
  // Total yang SUDAH dibayar dari piutang ongoing di atas.
  receivable_paid: number;
  // Sisa piutang ONGOING (= receivable_active - receivable_paid).
  receivable_remaining: number;
  // Sama 3 field di atas, untuk arah payable (utang).
  payable_active: number;
  payable_paid: number;
  payable_remaining: number;
};

// Rangkuman per kontak — cuma kontak yang PERNAH punya piutang/utang
// (join lewat debts) yang muncul. Versi mobile tanpa filter/sort/
// deleted_at (lihat docs/todos/plan/porting-account-debt.md bagian
// Keputusan) — pola query sama seperti use-contact-summary.ts desktop.
export async function getContactSummary(db: Db): Promise<ContactDebtSummary[]> {
  return db.getAllAsync<ContactDebtSummary>(`
    SELECT
      contacts.id AS contact_id,
      contacts.name AS contact_name,
      COALESCE((
        SELECT SUM(debts.amount) FROM debts
        WHERE debts.contact_id = contacts.id AND debts.type = 'receivable' AND debts.status = 'ongoing'
      ), 0) AS receivable_active,
      COALESCE((
        SELECT SUM(debt_payments.amount)
        FROM debt_payments
        JOIN debts ON debts.id = debt_payments.debt_id
        WHERE debts.contact_id = contacts.id AND debts.type = 'receivable' AND debts.status = 'ongoing'
      ), 0) AS receivable_paid,
      COALESCE((
        SELECT SUM(${remainingDebtSql()})
        FROM debts
        WHERE debts.contact_id = contacts.id AND debts.type = 'receivable' AND debts.status = 'ongoing'
      ), 0) AS receivable_remaining,
      COALESCE((
        SELECT SUM(debts.amount) FROM debts
        WHERE debts.contact_id = contacts.id AND debts.type = 'payable' AND debts.status = 'ongoing'
      ), 0) AS payable_active,
      COALESCE((
        SELECT SUM(debt_payments.amount)
        FROM debt_payments
        JOIN debts ON debts.id = debt_payments.debt_id
        WHERE debts.contact_id = contacts.id AND debts.type = 'payable' AND debts.status = 'ongoing'
      ), 0) AS payable_paid,
      COALESCE((
        SELECT SUM(${remainingDebtSql()})
        FROM debts
        WHERE debts.contact_id = contacts.id AND debts.type = 'payable' AND debts.status = 'ongoing'
      ), 0) AS payable_remaining
    FROM contacts
    WHERE EXISTS (SELECT 1 FROM debts WHERE debts.contact_id = contacts.id)
    ORDER BY contacts.name COLLATE NOCASE ASC
  `);
}

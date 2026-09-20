import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export const contactSummaryQueryKey = ["debts", "contact-summary"];

export type ContactDebtSummary = {
  contact_id: number;
  contact_name: string;
  /** Total sisa piutang ONGOING milik kontak ini (uang yang masih harus
   * dikembalikan ke saya). 0 kalau tidak ada. */
  receivable_remaining: number;
  /** Total sisa utang ONGOING ke kontak ini (uang yang masih harus saya
   * kembalikan). 0 kalau tidak ada. */
  payable_remaining: number;
};

/** Rangkuman per kontak — tujuan inti fitur ini (lihat "Masalah inti" di
 * debt-receivable-tracking.md): jawab "si X total masih pinjam berapa ke
 * saya sekarang" tanpa jumlah manual. Cuma kontak yang PERNAH punya
 * piutang/utang (join lewat debts) yang muncul di sini. */
export function useContactSummary() {
  return useQuery({
    queryKey: contactSummaryQueryKey,
    queryFn: async (): Promise<ContactDebtSummary[]> => {
      const db = await getDb();
      return db.select<ContactDebtSummary[]>(
        `SELECT
           contacts.id AS contact_id,
           contacts.name AS contact_name,
           COALESCE((
             SELECT SUM(
               debts.amount - COALESCE(
                 (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
                 0
               )
             )
             FROM debts
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'receivable'
               AND debts.status = 'ongoing'
           ), 0) AS receivable_remaining,
           COALESCE((
             SELECT SUM(
               debts.amount - COALESCE(
                 (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
                 0
               )
             )
             FROM debts
             WHERE debts.contact_id = contacts.id
               AND debts.type = 'payable'
               AND debts.status = 'ongoing'
           ), 0) AS payable_remaining
         FROM contacts
         WHERE EXISTS (SELECT 1 FROM debts WHERE debts.contact_id = contacts.id)
         ORDER BY contacts.name COLLATE NOCASE`
      );
    },
  });
}

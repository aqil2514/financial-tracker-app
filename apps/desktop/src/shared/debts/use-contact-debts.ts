import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";
import { remainingDebtSql } from "./remaining-debt-sql";

export const contactDebtsQueryKey = ["debts", "contact-debts"];

export type ContactDebtRow = Debt & {
  account_name: string | null;
  remaining: number;
};

/** Semua `debts` (piutang DAN utang, SEMUA status) milik SATU kontak —
 * dipakai dialog detail kontak (features/debts-summary/content/card/detail/),
 * beda dari `useDebtsList` yang difilter per `type` untuk halaman
 * /debts/receivables & /payables, bukan per kontak. */
export function useContactDebts(contactId: string | undefined) {
  return useQuery({
    queryKey: [...contactDebtsQueryKey, contactId],
    enabled: contactId != null,
    queryFn: async (): Promise<ContactDebtRow[]> => {
      const db = await getDb();
      return db.select<ContactDebtRow[]>(
        `SELECT
           debts.*,
           accounts.name AS account_name,
           ${remainingDebtSql()} AS remaining
         FROM debts
         LEFT JOIN accounts ON accounts.id = debts.account_id
         WHERE debts.contact_id = $1
           AND debts.deleted_at IS NULL
         ORDER BY debts.date DESC, debts.id DESC`,
        [contactId]
      );
    },
  });
}

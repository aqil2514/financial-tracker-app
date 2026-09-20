import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";

export const ongoingDebtsQueryKey = ["debts", "ongoing"];

export type OngoingDebt = Debt & { remaining: number };

/**
 * Piutang (`type='receivable'`, `status='ongoing'`) milik satu kontak —
 * dipakai untuk multi-select "Pelunasan piutang yang sudah ada" di form
 * transaksi. `remaining` = `amount - SUM(debt_payments.amount)`, diurut
 * dari `date` TERLAMA dulu supaya alokasi FIFO tinggal iterasi urutan ini.
 */
export function useOngoingDebts(contactId: number | null) {
  return useQuery({
    queryKey: [...ongoingDebtsQueryKey, contactId],
    queryFn: async (): Promise<OngoingDebt[]> => {
      const db = await getDb();
      return db.select<OngoingDebt[]>(
        `SELECT
           debts.*,
           debts.amount - COALESCE(
             (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
             0
           ) AS remaining
         FROM debts
         WHERE debts.contact_id = $1
           AND debts.type = 'receivable'
           AND debts.status = 'ongoing'
         ORDER BY debts.date ASC, debts.id ASC`,
        [contactId]
      );
    },
    enabled: contactId != null,
  });
}

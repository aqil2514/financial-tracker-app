import { useQuery } from "@tanstack/react-query";
import { getDb, type Debt } from "@/lib/db";

export const debtsListQueryKey = ["debts", "list"];

export type DebtListRow = Debt & {
  contact_name: string | null;
  account_name: string | null;
  remaining: number;
};

/** Semua `debts` dari satu `type` ('receivable'/'payable'), TERMASUK
 * yang sudah lunas/dihapuskan — read-only listing, filter status
 * dilakukan di UI (bukan di query) supaya tidak perlu re-fetch saat
 * user ganti filter. */
export function useDebtsList(type: "receivable" | "payable") {
  return useQuery({
    queryKey: [...debtsListQueryKey, type],
    queryFn: async (): Promise<DebtListRow[]> => {
      const db = await getDb();
      return db.select<DebtListRow[]>(
        `SELECT
           debts.*,
           contacts.name AS contact_name,
           accounts.name AS account_name,
           debts.amount - COALESCE(
             (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
             0
           ) AS remaining
         FROM debts
         LEFT JOIN contacts ON contacts.id = debts.contact_id
         LEFT JOIN accounts ON accounts.id = debts.account_id
         WHERE debts.type = $1
         ORDER BY debts.date DESC, debts.id DESC`,
        [type]
      );
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type CashflowSummaryRow = {
  income: number;
  expense: number;
};

export const cashflowSummaryQueryKey = ["reports", "cashflow-summary"];

export function useCashflowSummary(from: string, to: string) {
  return useQuery({
    queryKey: [...cashflowSummaryQueryKey, from, to],
    queryFn: async () => {
      const db = await getDb();
      const [row] = await db.select<CashflowSummaryRow[]>(
        `SELECT
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) as income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) as expense
         FROM transactions
         WHERE type IN ('income', 'expense')
           AND date(date) BETWEEN $1 AND $2`,
        [from, to]
      );
      return row;
    },
  });
}

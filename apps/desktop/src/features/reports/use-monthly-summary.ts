import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type MonthlySummaryRow = {
  month: string;
  income: number;
  expense: number;
};

export const monthlySummaryQueryKey = ["reports", "monthly-summary"];

export function useMonthlySummary(months: number) {
  return useQuery({
    queryKey: [...monthlySummaryQueryKey, months],
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<
        { month: string; type: "income" | "expense"; total: number }[]
      >(
        `SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total
         FROM transactions
         WHERE type IN ('income', 'expense')
           AND date >= strftime('%Y-%m', 'now', '-' || $1 || ' months') || '-01'
         GROUP BY month, type
         ORDER BY month ASC`,
        [months]
      );

      const byMonth = new Map<string, MonthlySummaryRow>();
      for (const row of rows) {
        const entry = byMonth.get(row.month) ?? {
          month: row.month,
          income: 0,
          expense: 0,
        };
        entry[row.type] = row.total;
        byMonth.set(row.month, entry);
      }

      return Array.from(byMonth.values()).sort((a, b) =>
        a.month.localeCompare(b.month)
      );
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type MonthSummary = {
  income: number;
  expense: number;
};

export const monthSummaryQueryKey = ["transactions", "month-summary"];

export function useMonthSummary(monthStart: string) {
  return useQuery({
    queryKey: [...monthSummaryQueryKey, monthStart],
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<{ type: "income" | "expense"; total: number }[]>(
        `SELECT type, SUM(amount) as total
         FROM transactions
         WHERE strftime('%Y-%m', date) = $1
           AND type IN ('income', 'expense')
         GROUP BY type`,
        [monthStart]
      );

      const summary: MonthSummary = { income: 0, expense: 0 };
      for (const row of rows) {
        summary[row.type] = row.total;
      }
      return summary;
    },
  });
}

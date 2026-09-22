import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type CurrentMonthSummary = {
  income: number;
  expense: number;
};

export const currentMonthSummaryQueryKey = ["dashboard", "current-month-summary"];

export function useCurrentMonthSummary() {
  return useQuery({
    queryKey: currentMonthSummaryQueryKey,
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<{ type: "income" | "expense"; total: number }[]>(
        `SELECT type, SUM(amount) as total
         FROM transactions
         WHERE type IN ('income', 'expense')
           AND strftime('%Y-%m', date) = strftime('%Y-%m', 'now')
         GROUP BY type`
      );

      const summary: CurrentMonthSummary = { income: 0, expense: 0 };
      for (const row of rows) {
        summary[row.type] = row.total;
      }
      return summary;
    },
  });
}

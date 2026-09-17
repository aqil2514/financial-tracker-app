import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type DaySummary = {
  income: number;
  expense: number;
};

export const transactionDaysQueryKey = ["transactions", "days"];

export function useTransactionDays(monthStart: string) {
  return useQuery({
    queryKey: [...transactionDaysQueryKey, monthStart],
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<
        { day: string; type: "income" | "expense"; total: number }[]
      >(
        `SELECT date(date) as day, type, SUM(amount) as total
         FROM transactions
         WHERE strftime('%Y-%m', date) = $1
           AND type IN ('income', 'expense')
         GROUP BY day, type`,
        [monthStart]
      );

      const byDay = new Map<string, DaySummary>();
      for (const row of rows) {
        const entry = byDay.get(row.day) ?? { income: 0, expense: 0 };
        entry[row.type] = row.total;
        byDay.set(row.day, entry);
      }
      return byDay;
    },
  });
}

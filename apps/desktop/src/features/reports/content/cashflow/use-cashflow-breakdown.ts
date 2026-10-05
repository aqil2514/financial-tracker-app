import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type CashflowBreakdownRow = {
  group_name: string;
  total: number;
};

export const cashflowBreakdownQueryKey = ["reports", "cashflow-breakdown"];

export function useCashflowBreakdown(
  from: string,
  to: string,
  type: "income" | "expense"
) {
  return useQuery({
    queryKey: [...cashflowBreakdownQueryKey, from, to, type],
    queryFn: async () => {
      const db = await getDb();
      return db.select<CashflowBreakdownRow[]>(
        `SELECT COALESCE(g.name, 'Tanpa Grup') as group_name, SUM(t.amount) as total
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         LEFT JOIN account_groups g ON g.id = a.group_id
         WHERE t.type = $1
           AND date(t.date) BETWEEN $2 AND $3
         GROUP BY g.name
         ORDER BY total DESC`,
        [type, from, to]
      );
    },
  });
}

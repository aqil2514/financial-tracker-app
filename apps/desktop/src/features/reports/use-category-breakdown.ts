import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type CategoryBreakdownRow = {
  name: string;
  total: number;
};

export const categoryBreakdownQueryKey = ["reports", "category-breakdown"];

export function useCategoryBreakdown(months: number, type: "income" | "expense") {
  return useQuery({
    queryKey: [...categoryBreakdownQueryKey, months, type],
    queryFn: async () => {
      const db = await getDb();
      return db.select<CategoryBreakdownRow[]>(
        `SELECT c.name as name, SUM(t.amount) as total
         FROM transactions t
         JOIN categories c ON t.category_id = c.id
         WHERE t.type = $1
           AND t.date >= strftime('%Y-%m', 'now', '-' || $2 || ' months') || '-01'
         GROUP BY c.name
         ORDER BY total DESC`,
        [type, months]
      );
    },
  });
}

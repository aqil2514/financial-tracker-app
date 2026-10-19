import { useQuery } from "@tanstack/react-query";
import { getDb, type Transaction } from "@/lib/db";

export const categoryPeriodTransactionsQueryKey = ["reports", "category-period-transactions"];

export function useCategoryPeriodTransactions(periodId: string | null) {
  return useQuery({
    queryKey: [...categoryPeriodTransactionsQueryKey, periodId],
    enabled: periodId != null,
    queryFn: async (): Promise<Transaction[]> => {
      const db = await getDb();
      return db.select<Transaction[]>(
        `SELECT t.* FROM transactions t
         JOIN category_periods p ON p.id = $1
         WHERE t.type IN ('income', 'expense')
           AND t.is_cash_neutral = 0
           AND date(t.date) BETWEEN p.start_date AND p.end_date
           AND t.category_id IN (
             SELECT category_id FROM category_period_categories WHERE period_id = p.id
           )
         ORDER BY t.date DESC`,
        [periodId]
      );
    },
  });
}

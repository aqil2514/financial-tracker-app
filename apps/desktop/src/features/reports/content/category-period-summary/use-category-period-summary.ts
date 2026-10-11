import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export type CategoryPeriodSummaryRow = {
  income: number;
  expense: number;
};

export const categoryPeriodSummaryQueryKey = ["reports", "category-period-summary"];

export function useCategoryPeriodSummary(periodId: string | null) {
  return useQuery({
    queryKey: [...categoryPeriodSummaryQueryKey, periodId],
    enabled: periodId != null,
    queryFn: async (): Promise<CategoryPeriodSummaryRow> => {
      const db = await getDb();
      const [row] = await db.select<CategoryPeriodSummaryRow[]>(
        `SELECT
           COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) as income,
           COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as expense
         FROM transactions t
         JOIN category_periods p ON p.id = $1
         WHERE t.type IN ('income', 'expense')
           AND date(t.date) BETWEEN p.start_date AND p.end_date
           AND t.category_id IN (
             SELECT category_id FROM category_period_categories WHERE period_id = p.id
           )`,
        [periodId]
      );
      return row;
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDb, type CategoryPeriod } from "@/lib/db";

export const categoryPeriodsQueryKey = ["category_periods"];

export function useCategoryPeriods(categoryId: string | undefined) {
  return useQuery({
    queryKey: [...categoryPeriodsQueryKey, categoryId],
    enabled: categoryId != null,
    queryFn: async (): Promise<CategoryPeriod[]> => {
      const db = await getDb();
      return db.select<CategoryPeriod[]>(
        `SELECT category_periods.*
         FROM category_periods
         JOIN category_period_categories
           ON category_period_categories.period_id = category_periods.id
         WHERE category_period_categories.category_id = $1
         ORDER BY category_periods.start_date DESC`,
        [categoryId]
      );
    },
  });
}

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
        "SELECT * FROM category_periods WHERE category_id = $1 ORDER BY start_date DESC",
        [categoryId]
      );
    },
  });
}

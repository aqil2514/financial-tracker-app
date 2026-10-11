import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";
import { categoryPeriodsQueryKey } from "./use-category-periods";

export function usePeriodCategoryOptions() {
  return useQuery({
    queryKey: [...categoryPeriodsQueryKey, "category-options"],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const db = await getDb();
      return db.select<{ id: string; name: string }[]>(
        `SELECT DISTINCT categories.id, categories.name
         FROM categories
         JOIN category_period_categories
           ON category_period_categories.category_id = categories.id
         ORDER BY categories.name`
      );
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export function usePeriodCategoryIds(periodId: string | null) {
  return useQuery({
    queryKey: ["category_periods", periodId, "category-ids"],
    enabled: periodId != null,
    queryFn: async (): Promise<string[]> => {
      const db = await getDb();
      const rows = await db.select<{ category_id: string }[]>(
        "SELECT category_id FROM category_period_categories WHERE period_id = $1",
        [periodId]
      );
      return rows.map((row) => row.category_id);
    },
  });
}

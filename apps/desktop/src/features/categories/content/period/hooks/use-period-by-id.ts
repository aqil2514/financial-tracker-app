import { useQuery } from "@tanstack/react-query";
import { getDb, type CategoryPeriod } from "@/lib/db";

export function usePeriodById(id: string | null) {
  return useQuery({
    queryKey: ["category_periods", id],
    enabled: id != null,
    queryFn: async (): Promise<CategoryPeriod | null> => {
      const db = await getDb();
      const rows = await db.select<CategoryPeriod[]>(
        "SELECT * FROM category_periods WHERE id = $1",
        [id]
      );
      return rows[0] ?? null;
    },
  });
}

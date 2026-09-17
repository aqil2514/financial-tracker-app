import { useQuery } from "@tanstack/react-query";
import { getDb, type Category } from "@/lib/db";

export const categoriesQueryKey = ["categories"];

export function useCategories() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: async () => {
      const db = await getDb();
      return db.select<Category[]>(
        "SELECT * FROM categories ORDER BY name COLLATE NOCASE"
      );
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { getDb } from "@/lib/db";

export function categoryLabelsQueryKey(categoryId: string) {
  return ["category-labels", categoryId];
}

/** Sama persis use-transaction-labels.ts, tabel `category_labels`. */
export function useCategoryLabels(categoryId: string) {
  return useQuery({
    queryKey: categoryLabelsQueryKey(categoryId),
    queryFn: async () => {
      const db = await getDb();
      const rows = await db.select<{ name: string }[]>(
        `SELECT l.name as name
         FROM category_labels cl
         JOIN labels l ON l.id = cl.label_id
         WHERE cl.category_id = $1 AND cl.deleted_at IS NULL AND l.deleted_at IS NULL
         ORDER BY l.name COLLATE NOCASE`,
        [categoryId]
      );
      return rows.map((row) => row.name);
    },
  });
}

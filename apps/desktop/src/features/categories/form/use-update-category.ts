"use client";

import { getDb, type Category } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { categorySchema, type CategoryFormOutput } from "./category.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useUpdateCategory(category: Category) {
  return useEntityForm({
    schema: categorySchema,
    defaultValues: () => ({
      name: category.name,
      type: category.type,
      parent_id: category.parent_id != null ? String(category.parent_id) : null,
    }),
    resetOnOpen: true,
    mutationFn: async (values: CategoryFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE categories SET name = $1, type = $2, parent_id = $3 WHERE id = $4",
        [
          values.name,
          values.type,
          values.parent_id ? Number(values.parent_id) : null,
          category.id,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.categories,
    successMessage: "Kategori berhasil diperbarui",
    errorMessage: "Gagal memperbarui kategori",
  });
}

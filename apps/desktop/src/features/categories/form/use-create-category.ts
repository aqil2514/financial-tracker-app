"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { categorySchema, type CategoryFormOutput } from "./category.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useCreateCategory() {
  return useEntityForm({
    schema: categorySchema,
    defaultValues: () => ({
      name: "",
      type: "expense" as const,
      parent_id: null,
      is_active: "1" as const,
    }),
    mutationFn: async (values: CategoryFormOutput) => {
      const db = await getDb();
      await db.execute(
        "INSERT INTO categories (id, name, type, parent_id, is_active) VALUES ($1, $2, $3, $4, $5)",
        [
          newId(),
          values.name,
          values.type,
          values.parent_id ? values.parent_id : null,
          Number(values.is_active),
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.categories,
    successMessage: "Kategori berhasil ditambahkan",
    errorMessage: "Gagal menambahkan kategori",
  });
}

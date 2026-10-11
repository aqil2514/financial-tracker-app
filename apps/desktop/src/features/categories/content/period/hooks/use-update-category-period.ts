"use client";

import { format } from "date-fns";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import type { CategoryPeriodFormOutput } from "../form/schema";

type UseUpdateCategoryPeriodOptions = {
  onUpdated?: () => void;
};

type UpdateCategoryPeriodInput = {
  id: string;
  values: CategoryPeriodFormOutput;
};

export function useUpdateCategoryPeriod(options: UseUpdateCategoryPeriodOptions = {}) {
  const { onUpdated } = options;

  return useDbMutation({
    mutationFn: async ({ id, values }: UpdateCategoryPeriodInput) => {
      const db = await getDb();

      await db.execute(
        "UPDATE category_periods SET name = $1, start_date = $2, end_date = $3 WHERE id = $4",
        [
          values.name,
          format(values.date_range.from, "yyyy-MM-dd"),
          format(values.date_range.to, "yyyy-MM-dd"),
          id,
        ]
      );

      await db.execute("DELETE FROM category_period_categories WHERE period_id = $1", [id]);

      for (const categoryId of values.category_ids) {
        await db.execute(
          "INSERT INTO category_period_categories (id, period_id, category_id) VALUES ($1, $2, $3)",
          [newId(), id, categoryId]
        );
      }
    },
    invalidateKey: QUERY_DEPENDENCIES.categoryPeriods,
    successMessage: "Periode berhasil diperbarui",
    errorMessage: "Gagal memperbarui periode",
    onSuccess: () => {
      onUpdated?.();
    },
  });
}

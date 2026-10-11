"use client";

import { format } from "date-fns";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import type { CategoryPeriodFormOutput } from "../form/schema";

type UseCreateCategoryPeriodOptions = {
  onCreated?: (id: string) => void;
};

export function useCreateCategoryPeriod(options: UseCreateCategoryPeriodOptions = {}) {
  const { onCreated } = options;

  return useDbMutation({
    mutationFn: async (values: CategoryPeriodFormOutput) => {
      const db = await getDb();
      const id = newId();
      await db.execute(
        "INSERT INTO category_periods (id, name, start_date, end_date) VALUES ($1, $2, $3, $4)",
        [
          id,
          values.name,
          format(values.date_range.from, "yyyy-MM-dd"),
          format(values.date_range.to, "yyyy-MM-dd"),
        ]
      );

      for (const categoryId of values.category_ids) {
        await db.execute(
          "INSERT INTO category_period_categories (id, period_id, category_id) VALUES ($1, $2, $3)",
          [newId(), id, categoryId]
        );
      }

      return id;
    },
    invalidateKey: QUERY_DEPENDENCIES.categoryPeriods,
    successMessage: "Periode berhasil ditambahkan",
    errorMessage: "Gagal menambahkan periode",
    onSuccess: (id) => {
      onCreated?.(id);
    },
  });
}

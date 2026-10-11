"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

type UseDeleteCategoryPeriodOptions = {
  onDeleted?: () => void;
};

export function useDeleteCategoryPeriod(options: UseDeleteCategoryPeriodOptions = {}) {
  const { onDeleted } = options;

  return useDbMutation({
    mutationFn: async (id: string) => {
      const db = await getDb();
      await db.execute("DELETE FROM category_periods WHERE id = $1", [id]);
    },
    invalidateKey: QUERY_DEPENDENCIES.categoryPeriods,
    successMessage: "Periode berhasil dihapus",
    errorMessage: "Gagal menghapus periode",
    onSuccess: () => {
      onDeleted?.();
    },
  });
}

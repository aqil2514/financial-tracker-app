"use client";

import { getDb, type Category } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";

/** Aksi cepat toggle aktif/nonaktif lewat dot indikator di card (grid
 * kategori) — subset dari `useUpdateCategory` yang hanya menyentuh
 * `is_active`, tanpa buka dialog form lengkap. */
export function useToggleCategoryActive() {
  return useDbMutation<Category, void>({
    mutationFn: async (category) => {
      const db = await getDb();
      const nextIsActive = category.is_active ? 0 : 1;
      await db.execute("UPDATE categories SET is_active = $1 WHERE id = $2", [
        nextIsActive,
        category.id,
      ]);
      void pushOnWrite("categories", category.id);
    },
    invalidateKey: QUERY_DEPENDENCIES.categories,
    successMessage: "Status kategori diperbarui",
    errorMessage: "Gagal mengubah status kategori",
  });
}

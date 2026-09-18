"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";

export type DeleteCategoryInput = {
  id: number;
  /** Perlakuan sub-kategori (parent_id = id ini) — wajib diisi kalau masih ada sub-kategori. */
  childAction?: "unassign" | "reassign";
  targetParentId?: number;
  /** Perlakuan transaksi (category_id = id ini) — wajib diisi kalau masih ada transaksi. */
  transactionAction?: "unassign" | "reassign";
  targetCategoryId?: number;
};

export function useDeleteCategory() {
  return useDbMutation({
    mutationFn: async ({
      id,
      childAction,
      targetParentId,
      transactionAction,
      targetCategoryId,
    }: DeleteCategoryInput) => {
      const db = await getDb();

      if (childAction === "unassign") {
        await db.execute("UPDATE categories SET parent_id = NULL WHERE parent_id = $1", [id]);
      } else if (childAction === "reassign" && targetParentId != null) {
        await db.execute("UPDATE categories SET parent_id = $1 WHERE parent_id = $2", [
          targetParentId,
          id,
        ]);
      }

      if (transactionAction === "unassign") {
        await db.execute("UPDATE transactions SET category_id = NULL WHERE category_id = $1", [
          id,
        ]);
      } else if (transactionAction === "reassign" && targetCategoryId != null) {
        await db.execute(
          "UPDATE transactions SET category_id = $1 WHERE category_id = $2",
          [targetCategoryId, id]
        );
      }

      await db.execute("DELETE FROM categories WHERE id = $1", [id]);
    },
    invalidateKey: dependentKeysOf("transactions", "categories"),
    successMessage: "Kategori berhasil dihapus",
    errorMessage: "Gagal menghapus kategori",
  });
}

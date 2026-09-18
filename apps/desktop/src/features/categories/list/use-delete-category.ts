"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useDeleteCategory() {
  return useDbMutation({
    mutationFn: async (id: number) => {
      const db = await getDb();

      const [{ count: transactionCount }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM transactions WHERE category_id = $1",
        [id]
      );
      if (transactionCount > 0) {
        throw new Error(
          `Masih dipakai oleh ${transactionCount} transaksi. Ubah kategori transaksi tersebut terlebih dahulu.`
        );
      }

      const [{ count: childCount }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM categories WHERE parent_id = $1",
        [id]
      );
      if (childCount > 0) {
        throw new Error(
          `Masih punya ${childCount} sub-kategori. Hapus atau pindahkan sub-kategori tersebut terlebih dahulu.`
        );
      }

      await db.execute("DELETE FROM categories WHERE id = $1", [id]);
    },
    invalidateKey: QUERY_DEPENDENCIES.categories,
    successMessage: "Kategori berhasil dihapus",
    errorMessage: "Gagal menghapus kategori",
  });
}

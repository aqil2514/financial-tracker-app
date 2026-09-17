"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useDeleteTransaction() {
  return useDbMutation({
    mutationFn: async (id: number) => {
      const db = await getDb();
      await db.execute("DELETE FROM transactions WHERE id = $1", [id]);
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil dihapus",
    errorMessage: "Gagal menghapus transaksi",
  });
}

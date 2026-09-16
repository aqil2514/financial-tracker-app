"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { accountsQueryKey } from "@/features/accounts";
import { transactionsQueryKey } from "./use-transactions";

export function useDeleteTransaction() {
  return useDbMutation({
    mutationFn: async (id: number) => {
      const db = await getDb();
      await db.execute("DELETE FROM transactions WHERE id = $1", [id]);
    },
    invalidateKey: [transactionsQueryKey, accountsQueryKey],
    successMessage: "Transaksi berhasil dihapus",
    errorMessage: "Gagal menghapus transaksi",
  });
}

"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { accountsQueryKey } from "./use-accounts";

export function useDeleteAccount() {
  return useDbMutation({
    mutationFn: async (id: number) => {
      const db = await getDb();
      await db.execute("DELETE FROM accounts WHERE id = $1", [id]);
    },
    invalidateKey: accountsQueryKey,
    successMessage: "Akun berhasil dihapus",
    errorMessage: "Gagal menghapus akun",
  });
}

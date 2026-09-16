"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { accountGroupsQueryKey } from "./use-account-groups";

export function useDeleteAccountGroup() {
  return useDbMutation({
    mutationFn: async (id: number) => {
      const db = await getDb();
      const [{ count }] = await db.select<{ count: number }[]>(
        "SELECT COUNT(*) as count FROM accounts WHERE group_id = $1",
        [id]
      );
      if (count > 0) {
        throw new Error(
          `Masih dipakai oleh ${count} akun. Ubah group akun tersebut terlebih dahulu.`
        );
      }
      await db.execute("DELETE FROM account_groups WHERE id = $1", [id]);
    },
    invalidateKey: accountGroupsQueryKey,
    successMessage: "Group akun berhasil dihapus",
    errorMessage: "Gagal menghapus group akun",
  });
}

"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";

export type DeleteAccountInput = {
  id: number;
  /**
   * Perlakuan transaksi yang masih merujuk akun ini (account_id ATAU
   * transfer_account_id) — wajib diisi kalau masih ada transaksi terkait.
   * "reassign" mengganti akun ini dengan targetAccountId di KEDUA kolom
   * sekaligus.
   */
  transactionAction?: "unassign" | "reassign";
  targetAccountId?: number;
};

export function useDeleteAccount() {
  return useDbMutation({
    mutationFn: async ({ id, transactionAction, targetAccountId }: DeleteAccountInput) => {
      const db = await getDb();

      if (transactionAction === "unassign") {
        await db.execute("UPDATE transactions SET account_id = NULL WHERE account_id = $1", [
          id,
        ]);
        await db.execute(
          "UPDATE transactions SET transfer_account_id = NULL WHERE transfer_account_id = $1",
          [id]
        );
      } else if (transactionAction === "reassign" && targetAccountId != null) {
        await db.execute(
          "UPDATE transactions SET account_id = $1 WHERE account_id = $2",
          [targetAccountId, id]
        );
        await db.execute(
          "UPDATE transactions SET transfer_account_id = $1 WHERE transfer_account_id = $2",
          [targetAccountId, id]
        );
      }

      await db.execute("DELETE FROM accounts WHERE id = $1", [id]);
    },
    invalidateKey: dependentKeysOf("transactions", "accounts"),
    successMessage: "Akun berhasil dihapus",
    errorMessage: "Gagal menghapus akun",
  });
}

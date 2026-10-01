"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";

export type DeleteAccountGroupInput = {
  id: string;
  /** Perlakuan akun anggota grup ini — wajib diisi kalau grup masih punya anggota. */
  memberAction?: "unassign" | "reassign";
  /** Wajib diisi kalau memberAction === "reassign". */
  targetGroupId?: string;
};

export function useDeleteAccountGroup() {
  return useDbMutation({
    mutationFn: async ({ id, memberAction, targetGroupId }: DeleteAccountGroupInput) => {
      // Push ke Worker SEBELUM hard-delete lokal (keputusan 2026-10-01)
      // -- payload DELETE cuma butuh id, tidak perlu baca row setelah
      // dihapus. Gagal/offline tidak memblokir delete lokal (desktop
      // offline-first), masuk antrian retry dgn action yang sama.
      await pushDeleteOnWrite("account_groups", id, { memberAction, targetGroupId });

      const db = await getDb();

      if (memberAction === "unassign") {
        await db.execute("UPDATE accounts SET group_id = NULL WHERE group_id = $1", [id]);
      } else if (memberAction === "reassign" && targetGroupId != null) {
        await db.execute("UPDATE accounts SET group_id = $1 WHERE group_id = $2", [
          targetGroupId,
          id,
        ]);
      }

      await db.execute("DELETE FROM account_groups WHERE id = $1", [id]);
    },
    invalidateKey: dependentKeysOf("accounts", "accountGroups"),
    successMessage: "Group akun berhasil dihapus",
    errorMessage: "Gagal menghapus group akun",
  });
}

"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";

export function useDeleteContact() {
  return useDbMutation({
    mutationFn: async (id: string) => {
      await pushDeleteOnWrite("contacts", id, {});

      const db = await getDb();
      await db.execute("DELETE FROM contacts WHERE id = $1", [id]);
    },
    invalidateKey: QUERY_DEPENDENCIES.contacts,
    successMessage: "Kontak berhasil dihapus",
    errorMessage: "Gagal menghapus kontak",
  });
}

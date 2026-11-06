"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { detachLabelOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";

const JUNCTIONS = [
  { table: "transaction_labels", column: "transaction_id", scope: "transactions" },
  { table: "category_labels", column: "category_id", scope: "categories" },
  { table: "account_labels", column: "account_id", scope: "accounts" },
] as const;

export function useDeleteLabel() {
  return useDbMutation({
    mutationFn: async (id: string) => {
      const db = await getDb();

      // Worker hanya soft-delete label dan tidak menyentuh baris junction-nya. Lepas dulu satu per satu supaya
      // cloud tidak menyimpan pemasangan yang menunjuk label terhapus (perangkat lain gagal menerapkannya).
      for (const { table, column, scope } of JUNCTIONS) {
        const rows = await db.select<{ entity_id: string }[]>(
          `SELECT ${column} AS entity_id FROM ${table} WHERE label_id = $1 AND deleted_at IS NULL`,
          [id]
        );
        for (const row of rows) await detachLabelOnWrite(scope, row.entity_id, id);
        await db.execute(`DELETE FROM ${table} WHERE label_id = $1`, [id]);
      }

      await pushDeleteOnWrite("labels", id, {});
      await db.execute("DELETE FROM labels WHERE id = $1", [id]);
    },
    invalidateKey: QUERY_DEPENDENCIES.labels,
    successMessage: "Label berhasil dihapus",
    errorMessage: "Gagal menghapus label",
  });
}

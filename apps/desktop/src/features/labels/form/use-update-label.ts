"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { LabelWithUsage } from "@/shared/labels/use-label-list";
import { assertUniqueLabelName } from "./assert-unique-label-name";
import { labelSchema, type LabelFormOutput } from "./label.schema";

// Scope tidak ikut diubah: label tidak boleh pindah dictionary (Worker menolaknya juga).
export function useUpdateLabel(label: LabelWithUsage) {
  return useEntityForm({
    schema: labelSchema,
    defaultValues: () => ({
      name: label.name,
      scope: label.scope,
    }),
    resetOnOpen: true,
    mutationFn: async (values: LabelFormOutput) => {
      await assertUniqueLabelName({ ...values, scope: label.scope }, label.id);
      const db = await getDb();
      await db.execute("UPDATE labels SET name = $1 WHERE id = $2", [values.name, label.id]);
      void pushOnWrite("labels", label.id);
    },
    invalidateKey: QUERY_DEPENDENCIES.labels,
    successMessage: "Label berhasil diperbarui",
    errorMessage: "Gagal memperbarui label",
  });
}

"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { assertUniqueLabelName } from "./assert-unique-label-name";
import { labelSchema, type LabelFormOutput } from "./label.schema";

export function useCreateLabel() {
  return useEntityForm({
    schema: labelSchema,
    defaultValues: () => ({
      name: "",
      scope: "transaction_category" as const,
    }),
    mutationFn: async (values: LabelFormOutput) => {
      await assertUniqueLabelName(values);
      const db = await getDb();
      const id = newId();
      await db.execute("INSERT INTO labels (id, name, scope) VALUES ($1, $2, $3)", [id, values.name, values.scope]);
      void pushOnWrite("labels", id);
    },
    invalidateKey: QUERY_DEPENDENCIES.labels,
    successMessage: "Label berhasil ditambahkan",
    errorMessage: "Gagal menambahkan label",
  });
}

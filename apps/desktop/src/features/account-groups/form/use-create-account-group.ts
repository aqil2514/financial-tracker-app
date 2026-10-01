"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import {
  accountGroupSchema,
  type AccountGroupFormOutput,
} from "./account-group.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";

export function useCreateAccountGroup() {
  return useEntityForm({
    schema: accountGroupSchema,
    defaultValues: () => ({ name: "" }),
    mutationFn: async (values: AccountGroupFormOutput) => {
      const db = await getDb();
      const id = newId();
      await db.execute("INSERT INTO account_groups (id, name) VALUES ($1, $2)", [
        id,
        values.name,
      ]);
      void pushOnWrite("account_groups", id);
    },
    invalidateKey: QUERY_DEPENDENCIES.accountGroups,
    successMessage: "Group akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan group akun",
  });
}

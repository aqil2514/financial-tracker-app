"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import {
  accountGroupSchema,
  type AccountGroupFormOutput,
} from "./account-group.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useCreateAccountGroup() {
  return useEntityForm({
    schema: accountGroupSchema,
    defaultValues: () => ({ name: "" }),
    mutationFn: async (values: AccountGroupFormOutput) => {
      const db = await getDb();
      await db.execute("INSERT INTO account_groups (name) VALUES ($1)", [
        values.name,
      ]);
    },
    invalidateKey: QUERY_DEPENDENCIES.accountGroups,
    successMessage: "Group akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan group akun",
  });
}

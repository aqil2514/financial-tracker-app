"use client";

import { getDb, type AccountGroup } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import {
  accountGroupSchema,
  type AccountGroupFormOutput,
} from "./account-group.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useUpdateAccountGroup(group: AccountGroup) {
  return useEntityForm({
    schema: accountGroupSchema,
    defaultValues: () => ({ name: group.name }),
    resetOnOpen: true,
    mutationFn: async (values: AccountGroupFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE account_groups SET name = $1 WHERE id = $2",
        [values.name, group.id]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.accountGroups,
    successMessage: "Group akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui group akun",
  });
}

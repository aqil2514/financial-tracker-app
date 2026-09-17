"use client";

import { getDb, type Account } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useUpdateAccount(account: Account) {
  return useEntityForm({
    schema: accountSchema,
    defaultValues: () => ({
      name: account.name,
      initial_balance: account.initial_balance,
      group_id: account.group_id != null ? String(account.group_id) : null,
      description: account.description,
    }),
    resetOnOpen: true,
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE accounts SET name = $1, initial_balance = $2, group_id = $3, description = $4 WHERE id = $5",
        [
          values.name,
          values.initial_balance,
          values.group_id ? Number(values.group_id) : null,
          values.description,
          account.id,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui akun",
  });
}

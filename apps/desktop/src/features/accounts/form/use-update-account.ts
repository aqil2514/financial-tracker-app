"use client";

import { getDb, type Account } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useUpdateAccount(account: Account, onSuccess?: () => void) {
  return useEntityForm({
    schema: accountSchema,
    defaultValues: () => ({
      name: account.name,
      initial_balance: account.initial_balance,
      group_id: account.group_id != null ? String(account.group_id) : null,
      description: account.description,
      is_active: String(account.is_active) as "1" | "0",
      account_type: account.account_type,
    }),
    resetOnOpen: true,
    onSuccess,
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE accounts SET name = $1, initial_balance = $2, group_id = $3, description = $4, is_active = $5, account_type = $6 WHERE id = $7",
        [
          values.name,
          values.initial_balance,
          values.group_id ? Number(values.group_id) : null,
          values.description,
          Number(values.is_active),
          values.account_type,
          account.id,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui akun",
  });
}

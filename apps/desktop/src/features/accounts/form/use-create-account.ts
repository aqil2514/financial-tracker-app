"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";

export function useCreateAccount() {
  return useEntityForm({
    schema: accountSchema,
    defaultValues: () => ({
      name: "",
      initial_balance: 0,
      group_id: null,
      description: null,
      is_active: "1" as const,
      account_type: "cash" as const,
    }),
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "INSERT INTO accounts (name, initial_balance, group_id, description, is_active, account_type) VALUES ($1, $2, $3, $4, $5, $6)",
        [
          values.name,
          values.initial_balance,
          values.group_id ? Number(values.group_id) : null,
          values.description,
          Number(values.is_active),
          values.account_type,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan akun",
  });
}

"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { DEFAULT_ACCOUNT_COLOR } from "@/lib/account-colors";
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
      icon: null,
      color: DEFAULT_ACCOUNT_COLOR,
    }),
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "INSERT INTO accounts (name, initial_balance, group_id, description, is_active, account_type, icon, color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          values.name,
          values.initial_balance,
          values.group_id ? Number(values.group_id) : null,
          values.description,
          Number(values.is_active),
          values.account_type,
          values.icon,
          values.color,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan akun",
  });
}

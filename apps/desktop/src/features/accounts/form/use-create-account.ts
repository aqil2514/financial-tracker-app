"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { accountsQueryKey } from "../list/use-accounts";

export function useCreateAccount() {
  return useEntityForm({
    schema: accountSchema,
    defaultValues: () => ({
      name: "",
      initial_balance: 0,
      group_id: null,
      description: null,
    }),
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      await db.execute(
        "INSERT INTO accounts (name, initial_balance, group_id, description) VALUES ($1, $2, $3, $4)",
        [
          values.name,
          values.initial_balance,
          values.group_id ? Number(values.group_id) : null,
          values.description,
        ]
      );
    },
    invalidateKey: accountsQueryKey,
    successMessage: "Akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan akun",
  });
}

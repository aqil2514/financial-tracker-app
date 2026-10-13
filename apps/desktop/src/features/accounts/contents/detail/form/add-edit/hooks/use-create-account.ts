"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { resolveLabelIds } from "@/shared/labels/resolve-label-ids";
import { applyAccountLabels } from "@/shared/labels/apply-account-labels";
import type { AccountFormOutput } from "../schema";

type UseCreateAccountOptions = {
  onCreated?: (id: string) => void;
};

export function useCreateAccount(options: UseCreateAccountOptions = {}) {
  const { onCreated } = options;

  const mutation = useDbMutation({
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();
      const id = newId();
      await db.execute(
        "INSERT INTO accounts (id, name, initial_balance, group_id, description, is_active, account_type, icon, color) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [
          id,
          values.name,
          values.initial_balance,
          values.group_id ? values.group_id : null,
          values.description,
          Number(values.is_active),
          values.account_type,
          values.icon,
          values.color,
        ]
      );
      if (values.account_type === "investment") {
        await db.execute(
          "INSERT INTO investment_accounts (account_id, unit_label, current_market_value) VALUES ($1, $2, $3)",
          [id, values.unit_label, values.current_market_value]
        );
      }
      await pushOnWrite("accounts", id);
      if (values.account_type === "investment") {
        void pushOnWrite("investment_accounts", id);
      }

      const labelIds = await resolveLabelIds(values.label_names, "account");
      await applyAccountLabels(id, labelIds);

      return id;
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil ditambahkan",
    errorMessage: "Gagal menambahkan akun",
    onSuccess: (id) => {
      onCreated?.(id);
    },
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}

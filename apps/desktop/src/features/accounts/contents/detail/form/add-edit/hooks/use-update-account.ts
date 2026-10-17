"use client";

import { getDb, type Account } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { isAccountInUse } from "../helpers/is-account-in-use";
import { resolveLabelIds } from "@/shared/labels/resolve-label-ids";
import { applyAccountLabels } from "@/shared/labels/apply-account-labels";
import type { AccountFormOutput } from "../schema";

export function useUpdateAccount(account: Account, onUpdated?: () => void) {
  const mutation = useDbMutation({
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();

      if (values.account_type !== account.account_type && (await isAccountInUse(db, account.id))) {
        throw new Error(
          "Tipe akun tidak bisa diubah karena akun ini sudah punya transaksi/piutang-utang terkait."
        );
      }

      await db.execute(
        "UPDATE accounts SET name = $1, initial_balance = $2, group_id = $3, description = $4, is_active = $5, account_type = $6, icon = $7, color = $8 WHERE id = $9",
        [
          values.name,
          values.initial_balance,
          values.group_id ? values.group_id : null,
          values.description,
          Number(values.is_active),
          values.account_type,
          values.icon,
          values.color,
          account.id,
        ]
      );
      if (values.account_type === "investment") {
        const existing = await db.select<{ account_id: string }[]>(
          "SELECT account_id FROM investment_accounts WHERE account_id = $1",
          [account.id]
        );
        if (existing.length > 0) {
          await db.execute(
            `UPDATE investment_accounts SET unit_label = $1, current_market_value = $2, updated_at = datetime('now')
             WHERE account_id = $3`,
            [values.unit_label, values.current_market_value, account.id]
          );
        } else {
          await db.execute(
            "INSERT INTO investment_accounts (account_id, unit_label, current_market_value) VALUES ($1, $2, $3)",
            [account.id, values.unit_label, values.current_market_value]
          );
        }
      }
      if (values.account_type === "debt") {
        await db.execute(
          `INSERT INTO debt_accounts (account_id, direction) VALUES ($1, $2)
           ON CONFLICT(account_id) DO UPDATE SET direction = excluded.direction`,
          [account.id, values.debt_direction]
        );
      }
      await pushOnWrite("accounts", account.id);
      if (values.account_type === "investment") {
        void pushOnWrite("investment_accounts", account.id);
      }

      const labelIds = await resolveLabelIds(values.label_names, "account");
      await applyAccountLabels(account.id, labelIds);
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui akun",
    onSuccess: onUpdated,
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}

"use client";

import { getDb, type Account } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { isAccountInUse } from "./is-account-in-use";

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
      icon: account.icon,
      color: account.color,
    }),
    resetOnOpen: true,
    onSuccess,
    mutationFn: async (values: AccountFormOutput) => {
      const db = await getDb();

      // Safety net (lihat docs/concept/konsep-tipe-akun.md prinsip #3) --
      // form sudah disable field account_type via useAccountIsUsed
      // (edit-dialog/index.tsx), ini jaga-jaga kalau ada race (query
      // belum selesai saat submit, atau field ter-enable sesaat).
      // Worker (accounts/service.ts isAccountInUse) tetap penjaga akhir
      // utk SEMUA jalur tulis (push PC ini juga, MCP, dst).
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
          values.group_id ? Number(values.group_id) : null,
          values.description,
          Number(values.is_active),
          values.account_type,
          values.icon,
          values.color,
          account.id,
        ]
      );
      void pushOnWrite("accounts", account.id);
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui akun",
  });
}

"use client";

import { useEffect } from "react";

import { getDb, type Account } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { isAccountInUse } from "./is-account-in-use";
import { useInvestmentAccount } from "@/shared/investments/use-investment-account";

export function useUpdateAccount(account: Account, onSuccess?: () => void) {
  const { data: investmentAccount } = useInvestmentAccount(account.id);

  const entityForm = useEntityForm({
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
      unit_label: investmentAccount?.unit_label ?? null,
      current_market_value: investmentAccount?.current_market_value ?? null,
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
        // Upsert manual (query dulu, lalu INSERT atau UPDATE) -- pola
        // konsisten dgn konvensi app ini (lihat applyDebtTransactionEdit
        // dkk), bukan ON CONFLICT yg belum ada precedent-nya di
        // codebase. Akun bisa baru BERGANTI ke tipe investment di edit
        // ini (belum pernah punya baris investment_accounts), atau sudah
        // investment sejak awal (sekadar update unit_label/harga).
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
      // Sama alasan dgn use-create-account.ts -- investment_accounts punya
      // FK ke accounts(id), await push "accounts" dulu sebelum push
      // "investment_accounts" supaya tidak race (terutama kasus akun yg
      // BARU berganti tipe jadi investment, baris investment_accounts-nya
      // baru pertama kali dibuat di request kedua ini).
      await pushOnWrite("accounts", account.id);
      if (values.account_type === "investment") {
        void pushOnWrite("investment_accounts", account.id);
      }
    },
    invalidateKey: QUERY_DEPENDENCIES.accounts,
    successMessage: "Akun berhasil diperbarui",
    errorMessage: "Gagal memperbarui akun",
  });

  // useEntityForm's defaultValues() dipanggil SINKRON saat form mount/
  // resetOnOpen -- di titik itu useInvestmentAccount (query async) biasa
  // BELUM selesai fetch, jadi unit_label/current_market_value ikut
  // ter-reset ke null walau datanya sebenarnya ada. Effect ini push
  // ulang nilai begitu query selesai, TANPA form.reset() penuh (supaya
  // tidak menimpa field lain yang mungkin sudah diubah user duluan).
  useEffect(() => {
    if (investmentAccount == null) return;
    entityForm.form.setValue("unit_label", investmentAccount.unit_label);
    entityForm.form.setValue("current_market_value", investmentAccount.current_market_value);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reaksi ke data query saja, form stabil lewat closure
  }, [investmentAccount]);

  return entityForm;
}

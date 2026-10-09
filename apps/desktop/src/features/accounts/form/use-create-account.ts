"use client";

import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { useEntityForm } from "@/hooks/use-entity-form";
import { DEFAULT_ACCOUNT_COLOR } from "@/lib/account-colors";
import type { AccountType } from "@/lib/account-types";
import { accountSchema, type AccountFormOutput } from "./account.schema";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { resolveLabelIds } from "@/shared/labels/resolve-label-ids";
import { applyAccountLabels } from "@/shared/labels/apply-account-labels";

type UseCreateAccountOptions = {
  /** Prefill nama (mis. dari query combobox saat "buat baru" dipicu dari
   * form lain) dan/atau tipe akun (mis. "Tambah Akun Investasi" dari
   * halaman /investments — default tetap 'cash' kalau tidak diisi). */
  initialValues?: { name?: string; account_type?: AccountType };
  /** Dipanggil dengan id akun yang baru dibuat — dipakai caller (mis.
   * combobox akun di form transaksi) untuk langsung memilih akun baru
   * itu tanpa user perlu cari ulang. */
  onCreated?: (id: string) => void;
};

export function useCreateAccount(options: UseCreateAccountOptions = {}) {
  const { initialValues, onCreated } = options;

  return useEntityForm({
    schema: accountSchema,
    defaultValues: () => ({
      name: initialValues?.name ?? "",
      initial_balance: 0,
      group_id: null,
      description: null,
      is_active: "1" as const,
      account_type: initialValues?.account_type ?? "cash",
      icon: null,
      color: DEFAULT_ACCOUNT_COLOR,
      unit_label: null,
      current_market_value: null,
      label_names: [],
    }),
    resetOnOpen: true,
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
      // investment_accounts punya FK ke accounts(id) di sisi Worker --
      // push "accounts" WAJIB di-await SELESAI dulu sebelum push
      // "investment_accounts" dikirim, supaya tidak ada race condition
      // (keduanya fire-and-forget paralel bisa membuat request kedua
      // sampai ke Worker LEBIH DULU, FOREIGN KEY constraint failed --
      // bug nyata ditemukan saat smoke test Tahap 5).
      await pushOnWrite("accounts", id);
      if (values.account_type === "investment") {
        void pushOnWrite("investment_accounts", id);
      }

      // Label scope 'account' cuma relevan utk jenis instrumen investasi
      // (lihat account-form.tsx, field cuma tampil saat account_type
      // investment) -- tapi resolveLabelIds/applyAccountLabels aman
      // dipanggil apa pun account_type-nya, values.label_names pasti []
      // utk tipe lain krn field-nya tidak pernah dirender.
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
}

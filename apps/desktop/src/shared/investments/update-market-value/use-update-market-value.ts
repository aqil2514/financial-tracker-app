"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { updateMarketValueSchema, type UpdateMarketValueFormOutput } from "./schema";

/**
 * Jalan pintas update `investment_accounts.current_market_value` SAJA —
 * dipicu tombol pensil di `InvestmentPlStats` (header halaman detail),
 * supaya update rutin (mendorong staleness indicator tetap segar, lihat
 * docs/concept/konsep-investasi.md) tidak perlu buka dialog "Edit Akun"
 * penuh (nama/grup/status ikut ter-render padahal cuma 1 angka yang mau
 * diubah). Beda dari `AccountEditDialog` yang reuse `AccountForm` utuh.
 * TIDAK PERNAH menyentuh `accounts.balance` (prinsip inti di konsep),
 * `updated_at` ikut di-refresh lewat `datetime('now')` di UPDATE.
 */
export function useUpdateMarketValue(
  accountId: string,
  currentValue: number,
  onSuccess?: () => void
) {
  return useEntityForm({
    schema: updateMarketValueSchema,
    defaultValues: () => ({
      current_market_value: currentValue,
    }),
    resetOnOpen: true,
    onSuccess,
    mutationFn: async (values: UpdateMarketValueFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE investment_accounts SET current_market_value = $1, updated_at = datetime('now') WHERE account_id = $2",
        [values.current_market_value, accountId]
      );
    },
    invalidateKey: dependentKeysOf("accounts"),
    successMessage: "Nilai pasar terkini berhasil diperbarui",
    errorMessage: "Gagal memperbarui nilai pasar terkini",
  });
}

"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import type { InvestmentPurchaseRow } from "../use-investment-purchases";
import { editInvestmentPurchaseSchema, type EditInvestmentPurchaseFormOutput } from "./schema";

/**
 * Edit satu baris `investment_purchases` secara LANGSUNG — beda dari
 * `useCreateInvestmentPurchase` yang insert lewat transaksi transfer baru.
 * Dipakai untuk kasus "isi unit/harga belakangan begitu settlement
 * dikonfirmasi" (lihat migrasi 0038 + docs/concept/konsep-investasi.md
 * bagian "Settlement tertunda") — baris SUDAH ADA (lahir otomatis dari
 * transaksi transfer), cuma field unit/price_per_unit/status yang
 * dimutakhirkan di sini. TIDAK menyentuh `transactions`/`accounts.balance`
 * sama sekali (murni koreksi data riwayat lot).
 */
export function useUpdateInvestmentPurchase(purchase: InvestmentPurchaseRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: editInvestmentPurchaseSchema,
    defaultValues: () => ({
      unit: purchase.unit,
      price_per_unit: purchase.price_per_unit,
      status: purchase.status,
    }),
    resetOnOpen: true,
    onSuccess,
    mutationFn: async (values: EditInvestmentPurchaseFormOutput) => {
      const db = await getDb();
      await db.execute(
        "UPDATE investment_purchases SET unit = $1, price_per_unit = $2, status = $3 WHERE id = $4",
        [values.unit, values.price_per_unit, values.status, purchase.id]
      );
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Pembelian investasi berhasil diperbarui",
    errorMessage: "Gagal memperbarui pembelian investasi",
  });
}

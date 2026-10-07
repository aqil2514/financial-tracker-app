"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { settleInvestmentSale } from "@/shared/investments/apply-sell-investment-transaction";
import type { InvestmentSaleRow } from "@/shared/investments/use-investment-sales";
import { settleSaleSchema, type SettleSaleFormOutput } from "./schema";

/**
 * Settle satu baris `investment_sales` yang masih `pending` — baru di
 * titik INI dana benar-benar "cair" ke akun kas yang dipilih (lihat
 * komentar panjang di apply-sell-investment-transaction.ts,
 * settleInvestmentSale). Akun kas tujuan WAJIB dipilih di sini karena
 * baris pending TIDAK menyimpan akun kas tujuan sejak create (belum ada
 * transaksi/akun kas yang terlibat selama masih pending).
 */
export function useSettleInvestmentSale(sale: InvestmentSaleRow, onSuccess?: () => void) {
  return useEntityForm({
    schema: settleSaleSchema,
    defaultValues: () => ({ cash_account_id: "" }),
    resetOnOpen: true,
    onSuccess,
    mutationFn: async (values: SettleSaleFormOutput) => {
      const db = await getDb();
      const result = await settleInvestmentSale(db, sale.id, values.cash_account_id);
      void pushOnWrite("transactions", result.transactionId);
      if (result.adjustmentTransactionId != null) {
        void pushOnWrite("transactions", result.adjustmentTransactionId);
      }
      void pushOnWrite("investment_sales", sale.id);
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Penjualan investasi berhasil disettle",
    errorMessage: "Gagal men-settle penjualan investasi",
  });
}

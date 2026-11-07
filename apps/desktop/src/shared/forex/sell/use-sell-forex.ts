"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { sellForex } from "../sell-forex";
import { sellForexSchema, type SellForexFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function useSellForex(forexAccountId: string) {
  return useEntityForm({
    schema: sellForexSchema,
    defaultValues: () => ({
      cash_account_id: "",
      unit: 0,
      rate: 0,
      date: now(),
      note: "Jual valas",
    }),
    resetOnOpen: true,
    mutationFn: async (values: SellForexFormOutput) => {
      const db = await getDb();
      const result = await sellForex({
        db,
        forexAccountId,
        cashAccountId: values.cash_account_id,
        unit: values.unit,
        rate: values.rate,
        date: values.date,
        note: values.note,
      });

      // forex_sales punya FK ke dua transaksi: await push keduanya dulu.
      await pushOnWrite("transactions", result.transactionId);
      if (result.adjustmentTransactionId) {
        await pushOnWrite("transactions", result.adjustmentTransactionId);
      }
      void pushOnWrite("forex_sales", result.saleId);
      return result;
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Penjualan valas berhasil dicatat",
    errorMessage: "Gagal mencatat penjualan valas",
  });
}

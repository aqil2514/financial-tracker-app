"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
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
      return sellForex({
        db,
        forexAccountId,
        cashAccountId: values.cash_account_id,
        unit: values.unit,
        rate: values.rate,
        date: values.date,
        note: values.note,
      });
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Penjualan valas berhasil dicatat",
    errorMessage: "Gagal mencatat penjualan valas",
  });
}

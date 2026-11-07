"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { createForexPurchase } from "../create-forex-purchase";
import { newForexPurchaseSchema, type NewForexPurchaseFormOutput } from "./schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

// Belum ada push ke Worker: sync valas menyusul (lihat account-type-forex.md).
export function useCreateForexPurchase(forexAccountId: string) {
  return useEntityForm({
    schema: newForexPurchaseSchema,
    defaultValues: () => ({
      source: "cash" as const,
      cash_account_id: "",
      unit: 0,
      rate: 0,
      date: now(),
      note: "Beli valas",
    }),
    resetOnOpen: true,
    mutationFn: async (values: NewForexPurchaseFormOutput) => {
      const db = await getDb();
      return createForexPurchase({
        db,
        forexAccountId,
        cashAccountId: values.source === "cash" ? values.cash_account_id : null,
        unit: values.unit,
        rate: values.rate,
        date: values.date,
        note: values.note,
      });
    },
    invalidateKey: dependentKeysOf("transactions"),
    successMessage: "Pembelian valas berhasil dicatat",
    errorMessage: "Gagal mencatat pembelian valas",
  });
}

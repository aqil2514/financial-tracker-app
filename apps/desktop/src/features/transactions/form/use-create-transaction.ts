"use client";

import { getDb } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import {
  transactionSchema,
  type TransactionFormOutput,
} from "./transaction.schema";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function useCreateTransaction() {
  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: "expense" as const,
      amount: 0,
      account_id: "",
      category_id: null,
      transfer_account_id: null,
      note: null,
      date: now(),
    }),
    resetOnOpen: true,
    mutationFn: async (values: TransactionFormOutput) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO transactions (type, amount, category_id, account_id, transfer_account_id, note, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          values.type,
          values.amount,
          values.type === "transfer" || !values.category_id
            ? null
            : Number(values.category_id),
          Number(values.account_id),
          values.type === "transfer"
            ? Number(values.transfer_account_id)
            : null,
          values.note,
          values.date,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil ditambahkan",
    errorMessage: "Gagal menambahkan transaksi",
  });
}

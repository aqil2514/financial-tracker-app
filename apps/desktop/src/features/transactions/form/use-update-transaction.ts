"use client";

import { getDb, type Transaction } from "@/lib/db";
import { useEntityForm } from "@/hooks/use-entity-form";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import {
  transactionSchema,
  type TransactionFormOutput,
} from "./transaction.schema";

export function useUpdateTransaction(transaction: Transaction) {
  return useEntityForm({
    schema: transactionSchema,
    defaultValues: () => ({
      type: transaction.type,
      amount: transaction.amount,
      account_id: transaction.account_id != null ? String(transaction.account_id) : "",
      category_id:
        transaction.category_id != null ? String(transaction.category_id) : null,
      transfer_account_id:
        transaction.transfer_account_id != null
          ? String(transaction.transfer_account_id)
          : null,
      note: transaction.note,
      date: transaction.date,
    }),
    resetOnOpen: true,
    mutationFn: async (values: TransactionFormOutput) => {
      const db = await getDb();
      await db.execute(
        `UPDATE transactions
         SET type = $1, amount = $2, category_id = $3, account_id = $4, transfer_account_id = $5, note = $6, date = $7
         WHERE id = $8`,
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
          transaction.id,
        ]
      );
    },
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil diperbarui",
    errorMessage: "Gagal memperbarui transaksi",
  });
}

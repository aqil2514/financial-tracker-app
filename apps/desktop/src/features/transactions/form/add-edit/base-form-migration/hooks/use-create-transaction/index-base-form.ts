"use client";

import { useDbMutation } from "@/hooks/use-db-mutation";
import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import type { UseCreateTransactionBaseFormOptions } from "./type-base-form";
import { createTransaction } from "../create-transaction";
import { handleCreateTransactionSuccess } from "./handle-create-success";

export function useCreateTransactionBaseForm(options: UseCreateTransactionBaseFormOptions = {}) {
  const mutation = useDbMutation({
    mutationFn: createTransaction,
    invalidateKey: QUERY_DEPENDENCIES.transactions,
    successMessage: "Transaksi berhasil ditambahkan",
    errorMessage: "Gagal menambahkan transaksi",
    onSuccess: (transactionId) => handleCreateTransactionSuccess(transactionId, options),
  });

  return {
    onSubmit: mutation.mutate,
    isPending: mutation.isPending,
  };
}

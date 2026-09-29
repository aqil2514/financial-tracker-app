"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";

export type TransactionAttachment = {
  id: string;
  transaction_id: string;
  file_path: string;
  created_at: string;
};

export function transactionAttachmentsQueryKey(transactionId: string) {
  return ["transaction-attachments", transactionId];
}

export function useTransactionAttachments(transactionId: string | null) {
  return useQuery({
    queryKey: transactionAttachmentsQueryKey(transactionId ?? "none"),
    queryFn: async (): Promise<TransactionAttachment[]> => {
      const db = await getDb();
      return db.select<TransactionAttachment[]>(
        "SELECT * FROM transaction_attachments WHERE transaction_id = $1 ORDER BY created_at",
        [transactionId]
      );
    },
    enabled: transactionId != null,
  });
}

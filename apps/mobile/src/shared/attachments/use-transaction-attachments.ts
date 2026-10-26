import { useCallback, useState } from "react";
import { useDatabase } from "@/lib/database";
import type { TransactionAttachment } from "./attachment";

export function useTransactionAttachments(transactionId: string) {
  const db = useDatabase();
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await db.getAllAsync<TransactionAttachment>(
        "SELECT * FROM transaction_attachments WHERE transaction_id = ? ORDER BY created_at",
        [transactionId]
      );
      setAttachments(rows);
    } finally {
      setIsLoading(false);
    }
  }, [db, transactionId]);

  return { attachments, isLoading, refetch };
}

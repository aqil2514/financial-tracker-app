import { useCallback, useState } from "react";
import { useDatabase } from "@/lib/database";
import type { TransactionAttachment } from "./attachment";
import { deleteAttachmentById } from "./delete-attachment";

export function useDeleteAttachment(transactionId: string, onDone?: () => void) {
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);

  const deleteAttachment = useCallback(
    async (attachment: TransactionAttachment) => {
      setIsPending(true);
      try {
        await deleteAttachmentById(db, transactionId, attachment.id);
        onDone?.();
      } finally {
        setIsPending(false);
      }
    },
    [db, transactionId, onDone]
  );

  return { deleteAttachment, isPending };
}

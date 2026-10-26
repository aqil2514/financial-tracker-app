import { useCallback, useState } from "react";
import { useDatabase } from "@/lib/database";
import { saveAttachmentToTransaction } from "./save-pending-attachment";

export interface AddAttachmentInput {
  uri: string;
  name: string;
}

export function useAddAttachment(transactionId: string, onDone?: () => void) {
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);

  const addAttachment = useCallback(
    async (input: AddAttachmentInput) => {
      setIsPending(true);
      try {
        await saveAttachmentToTransaction(db, transactionId, input);
        onDone?.();
      } finally {
        setIsPending(false);
      }
    },
    [db, transactionId, onDone]
  );

  return { addAttachment, isPending };
}

import { toast } from "sonner";

import { saveAttachmentToTransaction } from "@/shared/attachments/use-add-attachment";
import type { UseCreateTransactionBaseFormOptions } from "./type-base-form";

export async function handleCreateTransactionSuccess(
  transactionId: string,
  options: UseCreateTransactionBaseFormOptions
): Promise<void> {
  const { getPendingAttachments, attachmentFolder = null, onAttachmentsSaved, onClosed } = options;
  const pending = getPendingAttachments?.() ?? [];

  if (pending.length > 0) {
    try {
      await Promise.all(
        pending.map((attachment) =>
          saveAttachmentToTransaction(transactionId, attachment.input, attachmentFolder)
        )
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Transaksi tersimpan, tapi lampiran gagal disimpan: ${detail}`);
    } finally {
      onAttachmentsSaved?.();
    }
  }

  onClosed?.();
}

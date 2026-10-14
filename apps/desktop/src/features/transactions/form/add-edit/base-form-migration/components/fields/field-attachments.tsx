import { ScrollArea } from "@/components/ui/scroll-area";
import { AttachmentUploader } from "@/shared/attachments/attachment-uploader";
import { PendingAttachmentUploader } from "@/shared/attachments/pending-attachment-uploader";
import { useTransactionFormFields } from "../../context/transaction-form-fields-context";

export function FieldAttachments() {
  const { transactionId, pendingAttachments, onPendingAttachmentsChange, isPending } =
    useTransactionFormFields();

  return (
    <ScrollArea className="h-48">
      {transactionId != null ? (
        <AttachmentUploader transactionId={transactionId} />
      ) : onPendingAttachmentsChange ? (
        <PendingAttachmentUploader
          pendingAttachments={pendingAttachments ?? []}
          onChange={onPendingAttachmentsChange}
          disabled={isPending}
        />
      ) : null}
    </ScrollArea>
  );
}

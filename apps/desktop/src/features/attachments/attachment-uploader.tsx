"use client";

import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAttachmentFolder } from "./use-attachment-folder";
import { useAddAttachment } from "./use-add-attachment";
import { useDeleteAttachment } from "./use-delete-attachment";
import { useTransactionAttachments } from "./use-transaction-attachments";
import { useAttachmentCapture } from "./use-attachment-capture";
import { AttachmentThumbnail } from "./attachment-thumbnail";

/**
 * Upload lampiran foto untuk transaksi yang SUDAH tersimpan (punya id) —
 * setiap foto yang ditangkap langsung disimpan ke disk + database. Untuk
 * form Tambah transaksi (belum ada id), pakai `PendingAttachmentUploader`.
 */
export function AttachmentUploader({ transactionId }: { transactionId: number }) {
  const { data: attachmentFolder } = useAttachmentFolder();
  const { data: attachments } = useTransactionAttachments(transactionId);
  const addAttachment = useAddAttachment(transactionId, attachmentFolder ?? null);
  const deleteAttachment = useDeleteAttachment(transactionId);

  const { isDraggingOver, setDropZoneEl, handlePickFile, handlePaste } =
    useAttachmentCapture((inputs) => {
      inputs.forEach((input) => addAttachment.mutate(input));
    });

  return (
    <div className="space-y-2">
      <Label>Lampiran Foto</Label>
      <div
        ref={setDropZoneEl}
        onPaste={handlePaste}
        tabIndex={0}
        className={`flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 outline-none transition-colors ${
          isDraggingOver ? "border-primary bg-primary/5" : "border-input"
        }`}
      >
        {attachments?.map((attachment) => (
          <AttachmentThumbnail
            key={attachment.id}
            attachment={attachment}
            onRemove={() => deleteAttachment.mutate(attachment)}
            isRemoving={deleteAttachment.isPending}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="size-20 flex-col gap-1"
          onClick={handlePickFile}
          disabled={addAttachment.isPending}
        >
          <ImagePlus className="size-5" />
          <span className="text-xs">Tambah</span>
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Pilih file, seret foto ke sini, atau tempel (paste) gambar hasil
        screenshot/copy image.
      </p>
    </div>
  );
}

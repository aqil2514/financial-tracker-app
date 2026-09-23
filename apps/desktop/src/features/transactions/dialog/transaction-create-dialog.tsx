"use client";

import { useRef, useState } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { useAttachmentFolder } from "@/shared/attachments/use-attachment-folder";
import {
  revokePendingAttachment,
  type PendingAttachment,
} from "@/shared/attachments/pending-attachment";
import { TransactionForm } from "../form/add-edit/form";
import { useCreateTransaction } from "../form/add-edit/hooks/use-create-transaction";
import { useTransactionsDialog } from "./context";

export function TransactionCreateDialog({
  defaultAccountId,
}: {
  /** Akun yang otomatis dipilih saat form dibuka — lihat
   * `useCreateTransaction`. */
  defaultAccountId?: number;
} = {}) {
  const { dialog, closeDialog } = useTransactionsDialog();
  const open = dialog?.type === "create";

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  // useCreateTransaction butuh data pending TERBARU saat submit terjadi,
  // bukan snapshot dari saat hook di-mount — dibaca lewat ref supaya tidak
  // perlu me-recreate mutationFn setiap kali pendingAttachments berubah.
  const pendingAttachmentsRef = useRef(pendingAttachments);
  pendingAttachmentsRef.current = pendingAttachments;

  const { data: attachmentFolder } = useAttachmentFolder();

  function clearPendingAttachments() {
    pendingAttachmentsRef.current.forEach(revokePendingAttachment);
    setPendingAttachments([]);
  }

  const { form, onSubmit, onSubmitAndContinue, isPending } = useCreateTransaction({
    open,
    getPendingAttachments: () => pendingAttachmentsRef.current,
    attachmentFolder: attachmentFolder ?? null,
    onAttachmentsSaved: clearPendingAttachments,
    onClosed: closeDialog,
    defaultAccountId,
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      clearPendingAttachments();
      closeDialog();
    }
  }

  return (
    <EntityFormDialog
      title="Tambah Transaksi"
      open={open}
      onOpenChange={handleOpenChange}
      contentClassName="sm:!max-w-6xl"
    >
      <TransactionForm
        form={form}
        onSubmit={onSubmit}
        onSubmitAndContinue={onSubmitAndContinue}
        isPending={isPending}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsChange={setPendingAttachments}
      />
    </EntityFormDialog>
  );
}

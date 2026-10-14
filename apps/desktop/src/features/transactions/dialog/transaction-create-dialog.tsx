"use client";

import { useRef, useState } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { useAttachmentFolder } from "@/shared/attachments/use-attachment-folder";
import {
  revokePendingAttachment,
  type PendingAttachment,
} from "@/shared/attachments/pending-attachment";
import { TransactionFormWithBaseForm } from "../form/add-edit/components/transaction-form-with-base-form";
import { useCreateTransactionBaseForm } from "../form/add-edit/hooks/use-create-transaction/index-base-form";
import { defaultTransactionValues } from "../form/add-edit/schema";
import { useTransactionsDialog } from "./context";

export function TransactionCreateDialog({
  defaultAccountId,
}: {
  /** Akun yang otomatis dipilih saat form dibuka. */
  defaultAccountId?: string;
} = {}) {
  const { dialog, closeDialog } = useTransactionsDialog();
  const open = dialog?.type === "create";

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  // mutationFn butuh data pending TERBARU saat submit terjadi, bukan
  // snapshot dari saat hook di-mount — dibaca lewat ref supaya tidak perlu
  // me-recreate mutationFn setiap kali pendingAttachments berubah.
  const pendingAttachmentsRef = useRef(pendingAttachments);
  pendingAttachmentsRef.current = pendingAttachments;

  const { data: attachmentFolder } = useAttachmentFolder();

  function clearPendingAttachments() {
    pendingAttachmentsRef.current.forEach(revokePendingAttachment);
    setPendingAttachments([]);
  }

  const { onSubmit, isPending } = useCreateTransactionBaseForm({
    getPendingAttachments: () => pendingAttachmentsRef.current,
    attachmentFolder: attachmentFolder ?? null,
    onAttachmentsSaved: clearPendingAttachments,
    onClosed: closeDialog,
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
      <TransactionFormWithBaseForm
        defaultValues={defaultTransactionValues({ account_id: defaultAccountId ?? "" })}
        onSubmit={onSubmit}
        isPending={isPending}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsChange={setPendingAttachments}
      />
    </EntityFormDialog>
  );
}

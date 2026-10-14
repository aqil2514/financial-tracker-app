"use client";

import { useRef, useState } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { useAttachmentFolder } from "@/shared/attachments/use-attachment-folder";
import {
  revokePendingAttachment,
  type PendingAttachment,
} from "@/shared/attachments/pending-attachment";
import { TransactionForm } from "../form/add-edit/components";
import { useCreateTransaction } from "../form/add-edit/hooks/use-create-transaction";
import { TransactionFormWithBaseForm } from "../form/add-edit/base-form-migration/components/transaction-form-with-base-form";
import { useCreateTransactionBaseForm } from "../form/add-edit/base-form-migration/hooks/use-create-transaction/index-base-form";
import { defaultTransactionValues } from "../form/add-edit/schema";
import { useTransactionsDialog } from "./context";

export function TransactionCreateDialog({
  defaultAccountId,
}: {
  /** Akun yang otomatis dipilih saat form dibuka — lihat
   * `useCreateTransaction`. */
  defaultAccountId?: string;
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

  const { form, onSubmit, isPending } = useCreateTransaction({
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
        isPending={isPending}
        pendingAttachments={pendingAttachments}
        onPendingAttachmentsChange={setPendingAttachments}
      />
    </EntityFormDialog>
  );
}

// Dialog uji coba terisolasi untuk patokan BaseForm (lihat
// base-form-migration/README.md) -- TIDAK menggantikan TransactionCreateDialog
// di atas, cuma pembanding, dipicu lewat dialog.type "create-base-form"
// terpisah. Belum ada handling pendingAttachments (lampiran sebelum
// transactionId ada) seperti versi lama -- field Lampiran di form ini
// akan nonaktif sampai itu diisi.
export function TransactionCreateDialogBaseForm() {
  const { dialog, closeDialog } = useTransactionsDialog();
  const open = dialog?.type === "create-base-form";

  const { onSubmit, isPending } = useCreateTransactionBaseForm({
    onClosed: closeDialog,
  });

  return (
    <EntityFormDialog
      title="Tambah Transaksi (BaseForm)"
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      contentClassName="sm:!max-w-6xl"
    >
      <TransactionFormWithBaseForm
        defaultValues={defaultTransactionValues()}
        onSubmit={onSubmit}
        isPending={isPending}
      />
    </EntityFormDialog>
  );
}
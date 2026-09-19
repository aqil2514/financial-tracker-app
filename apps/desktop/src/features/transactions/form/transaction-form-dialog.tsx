"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { KeyboardShortcutBadge } from "@/components/keyboard-shortcut-badge";
import { useCreateShortcut } from "@/hooks/use-create-shortcut";
import { useAttachmentFolder } from "@/shared/attachments/use-attachment-folder";
import {
  revokePendingAttachment,
  type PendingAttachment,
} from "@/shared/attachments/pending-attachment";
import { TransactionForm } from "./transaction-form";
import { useCreateTransaction } from "./use-create-transaction";

export function TransactionFormDialog() {
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

  const { open, setOpen, form, onSubmit, onSubmitAndContinue, isPending } =
    useCreateTransaction({
      getPendingAttachments: () => pendingAttachmentsRef.current,
      attachmentFolder: attachmentFolder ?? null,
      onAttachmentsSaved: clearPendingAttachments,
    });

  useCreateShortcut(() => setOpen(true));

  return (
    <EntityFormDialog
      trigger={
        <Button>
          Tambah Transaksi
          <KeyboardShortcutBadge shortcut="N" />
        </Button>
      }
      title="Tambah Transaksi"
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) clearPendingAttachments();
      }}
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

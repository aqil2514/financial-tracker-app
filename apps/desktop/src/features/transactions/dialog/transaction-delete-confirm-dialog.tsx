"use client";

import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog";
import { useDeleteTransaction } from "../shared/hooks/use-delete-transaction";
import { useTransactionsDialog } from "./context";

export function TransactionDeleteConfirmDialog() {
  const { dialog, closeDialog } = useTransactionsDialog();
  const open = dialog?.type === "delete-confirm";
  const transactionId = open && dialog.dataId ? Number(dialog.dataId) : null;

  const deleteTransaction = useDeleteTransaction();

  function handleConfirm() {
    if (transactionId == null) return;
    deleteTransaction.mutate(transactionId, { onSuccess: closeDialog });
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
      onConfirm={handleConfirm}
      isPending={deleteTransaction.isPending}
      title="Hapus transaksi ini?"
    />
  );
}

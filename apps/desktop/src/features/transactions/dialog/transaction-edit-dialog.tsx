"use client";

import type { Transaction } from "@/lib/db";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { TransactionForm } from "../form/transaction-form";
import { useTransactionById } from "../content/list/use-transaction-by-id";
import { useUpdateTransaction } from "../form/add-edit/hooks/use-update-transaction";
import { useTransactionsDialog } from "./context";

export function TransactionEditDialog() {
  const { dialog, closeDialog } = useTransactionsDialog();
  const open = dialog?.type === "edit";
  const transactionId = open && dialog.dataId ? Number(dialog.dataId) : null;

  const { data: transaction } = useTransactionById(transactionId);

  // useUpdateTransaction butuh `transaction` asli (untuk defaultValues,
  // mutationFn, dst) — tidak dipanggil sebelum data-nya siap, supaya
  // TIDAK ada percabangan render sebelum sebuah hook (Rules of Hooks).
  if (!open || !transaction) return null;

  return <TransactionEditDialogForm transaction={transaction} onClose={closeDialog} />;
}

function TransactionEditDialogForm({
  transaction,
  onClose,
}: {
  transaction: Transaction;
  onClose: () => void;
}) {
  const { form, onSubmit, isPending } = useUpdateTransaction(transaction, {
    open: true,
    onClosed: onClose,
  });

  return (
    <EntityFormDialog
      title="Edit Transaksi"
      open={true}
      onOpenChange={(next) => !next && onClose()}
      contentClassName="sm:!max-w-6xl"
    >
      <TransactionForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
        transactionId={transaction.id}
      />
    </EntityFormDialog>
  );
}

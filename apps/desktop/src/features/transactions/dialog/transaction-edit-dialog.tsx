"use client";

import type { Transaction } from "@/lib/db";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { useTransactionById } from "../shared/hooks/use-transaction-by-id";
import { TransactionFormWithBaseForm } from "../form/add-edit/components/transaction-form-with-base-form";
import { useUpdateTransactionBaseForm } from "../form/add-edit/hooks/use-update-transaction/index-base-form";
import { useTransactionsDialog } from "./context";

export function TransactionEditDialog() {
  const { dialog, closeDialog } = useTransactionsDialog();
  const open = dialog?.type === "edit";
  const transactionId = open && dialog.dataId ? dialog.dataId : null;

  const { data: transaction } = useTransactionById(transactionId);

  // useUpdateTransactionBaseForm butuh `transaction` asli (untuk
  // defaultValues, mutationFn, dst) — tidak dipanggil sebelum data-nya
  // siap, supaya TIDAK ada percabangan render sebelum sebuah hook (Rules
  // of Hooks).
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
  const { defaultValues, isLoading, onSubmit, isPending } = useUpdateTransactionBaseForm(
    transaction,
    { onClosed: onClose }
  );

  // Kontrak isLoading: form tidak boleh mount sebelum semua data
  // pendukung (status debt, investment, label) siap, supaya tidak reset
  // ke nilai kosong/parsial.
  if (isLoading) return null;

  return (
    <EntityFormDialog
      title="Edit Transaksi"
      open={true}
      onOpenChange={(next) => !next && onClose()}
      contentClassName="sm:!max-w-6xl"
    >
      <TransactionFormWithBaseForm
        defaultValues={defaultValues}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
        transactionId={transaction.id}
      />
    </EntityFormDialog>
  );
}

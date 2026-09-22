import { TransactionCreateDialog } from "./transaction-create-dialog";
import { TransactionEditDialog } from "./transaction-edit-dialog";
import { TransactionDetailDialog } from "./transaction-detail-dialog";
import { TransactionDeleteConfirmDialog } from "./transaction-delete-confirm-dialog";

export function TransactionsDialogs() {
  return (
    <>
      <TransactionCreateDialog />
      <TransactionEditDialog />
      <TransactionDetailDialog />
      <TransactionDeleteConfirmDialog />
    </>
  );
}

export { TransactionsDialogProvider, useTransactionsDialog } from "./context";

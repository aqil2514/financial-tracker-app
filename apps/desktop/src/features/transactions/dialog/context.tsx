"use client";

import { createDialogContext } from "@/provider/dialog-state";

export type TransactionDialogType =
  | "create"
  | "create-base-form"
  | "edit"
  | "detail"
  | "delete-confirm";

const { DialogProvider, useDialog } = createDialogContext<TransactionDialogType>();

export { DialogProvider as TransactionsDialogProvider };
export { useDialog as useTransactionsDialog };

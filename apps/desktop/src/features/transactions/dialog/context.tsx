"use client";

import { createDialogContext } from "@/hooks/create-dialog-context";

export type TransactionDialogType = "create" | "edit" | "detail" | "delete-confirm";

const { DialogProvider, useDialog } = createDialogContext<TransactionDialogType>();

export { DialogProvider as TransactionsDialogProvider };
export { useDialog as useTransactionsDialog };

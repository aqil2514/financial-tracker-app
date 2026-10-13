"use client";

import { createDialogQueryContext } from "@/provider/dialog-query-state";

export type AccountDialogType = "create" | "detail" | "edit" | "balance-correction" | "delete";

const { DialogProvider, useDialog } = createDialogQueryContext<AccountDialogType>();

export { DialogProvider as AccountsDialogProvider };
export { useDialog as useAccountsDialog };

"use client";

import { useAccounts } from "@/hooks/resources/use-accounts";
import { useAccountsDialog } from "../context";
import { AccountDetailDialog } from "./index";

export function AccountDetailDialogController() {
  const { dialog, closeDialog } = useAccountsDialog();
  const { data: accounts } = useAccounts();

  const open = dialog?.type === "detail";
  const account = open ? accounts?.find((a) => a.id === dialog.dataId) : undefined;

  if (!account) return null;

  return (
    <AccountDetailDialog
      account={account}
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
    />
  );
}

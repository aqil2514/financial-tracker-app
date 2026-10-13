"use client";

import { useAccounts } from "@/hooks/resources/use-accounts";
import { useAccountsDialog } from "../context";
import { AccountBalanceCorrectionDialog } from "./index";

export function AccountBalanceCorrectionDialogController() {
  const { dialog, closeDialog } = useAccountsDialog();
  const { data: accounts } = useAccounts();

  const open = dialog?.type === "balance-correction";
  const account = open ? accounts?.find((a) => a.id === dialog.dataId) : undefined;

  if (!account) return null;

  return (
    <AccountBalanceCorrectionDialog
      account={account}
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
    />
  );
}

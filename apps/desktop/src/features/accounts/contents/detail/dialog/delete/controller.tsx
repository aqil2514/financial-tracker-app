"use client";

import { useAccounts } from "@/hooks/resources/use-accounts";
import { useAccountsDialog } from "../context";
import { DeleteAccountDialog } from "./index";

export function DeleteAccountDialogController() {
  const { dialog, closeDialog } = useAccountsDialog();
  const { data: accounts } = useAccounts();

  const open = dialog?.type === "delete";
  const account = open ? accounts?.find((a) => a.id === dialog.dataId) : undefined;

  if (!account) return null;

  return (
    <DeleteAccountDialog
      account={account}
      open={open}
      onOpenChange={(next) => !next && closeDialog()}
    />
  );
}

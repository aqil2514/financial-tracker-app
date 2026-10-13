"use client";

import { AccountFormDialog } from "./create";
import { AccountDetailDialogController } from "./detail/controller";
import { AccountEditDialogController } from "./edit";
import { AccountBalanceCorrectionDialogController } from "./balance-correction/controller";
import { DeleteAccountDialogController } from "./delete/controller";
import { useAccountsDialog } from "./context";

export function AccountsDialogs() {
  const { dialog } = useAccountsDialog();

  return (
    <>
      {dialog?.type === "create" && <AccountFormDialog />}
      <AccountDetailDialogController />
      <AccountEditDialogController />
      <AccountBalanceCorrectionDialogController />
      <DeleteAccountDialogController />
    </>
  );
}

export { AccountsDialogProvider, useAccountsDialog } from "./context";

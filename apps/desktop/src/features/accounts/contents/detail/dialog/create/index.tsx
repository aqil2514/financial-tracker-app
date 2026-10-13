"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountForm, defaultAccountValues, useCreateAccount } from "../../form";
import { useAccountsDialog } from "../context";

export function AccountFormDialog() {
  const { dialog, closeDialog } = useAccountsDialog();
  const open = dialog?.type === "create";

  const { onSubmit, isPending } = useCreateAccount({
    onCreated: closeDialog,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="sm:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Tambah Akun Baru</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={defaultAccountValues()}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

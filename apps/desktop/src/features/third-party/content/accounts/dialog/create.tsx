"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountForm, defaultAccountValues, useCreateAccount } from "@/features/accounts";
import { useThirdPartyAccountDialog } from "./context";

export function ThirdPartyCreateAccountDialog() {
  const { dialog, closeDialog } = useThirdPartyAccountDialog();
  const open = dialog?.type === "create";

  const { onSubmit, isPending } = useCreateAccount({
    onCreated: closeDialog,
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent className="sm:max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Tambah Akun Dana Pihak Ketiga</DialogTitle>
        </DialogHeader>
        <AccountForm
          defaultValues={{ ...defaultAccountValues(), account_type: "third_party" }}
          onSubmit={onSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

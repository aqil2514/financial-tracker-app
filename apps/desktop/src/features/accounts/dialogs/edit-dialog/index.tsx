"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { AccountForm } from "../../form/account-form";
import { useUpdateAccount } from "../../form/use-update-account";

export function AccountEditDialog({
  account,
  /** Dikontrol dari luar (mis. item di ListItemActionsMenu) — kalau
   * diisi, tombol pensil bawaan disembunyikan dan dialog dibuka/ditutup
   * lewat pasangan `open`/`onOpenChange` ini. */
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  account: Account;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { open, setOpen, form, onSubmit, isPending } = useUpdateAccount(account);

  const isControlled = controlledOpen !== undefined;

  useEffect(() => {
    if (isControlled) setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, controlledOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setControlledOpen?.(next);
  }

  return (
    <EntityFormDialog
      trigger={
        isControlled ? undefined : (
          <Button variant="ghost" size="icon-sm">
            <Pencil className="size-4" />
          </Button>
        )
      }
      title="Edit Akun"
      open={open}
      onOpenChange={handleOpenChange}
    >
      <AccountForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
      />
    </EntityFormDialog>
  );
}

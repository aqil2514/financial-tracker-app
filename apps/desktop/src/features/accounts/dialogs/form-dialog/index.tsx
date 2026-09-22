"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { KeyboardShortcutBadge } from "@/components/keyboard-shortcut-badge";
import { useCreateShortcut } from "@/hooks/use-create-shortcut";
import { AccountForm } from "../../form/account-form";
import { useCreateAccount } from "../../form/use-create-account";

export function AccountFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateAccount();

  useCreateShortcut(() => setOpen(true));

  return (
    <EntityFormDialog
      trigger={
        <Button>
          Tambah Akun
          <KeyboardShortcutBadge shortcut="N" />
        </Button>
      }
      title="Tambah Akun Baru"
      open={open}
      onOpenChange={setOpen}
    >
      <AccountForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

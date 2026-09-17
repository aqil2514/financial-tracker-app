"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { AccountForm } from "./account-form";
import { useCreateAccount } from "./use-create-account";

export function AccountFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateAccount();

  return (
    <EntityFormDialog
      trigger={<Button>Tambah Akun</Button>}
      title="Tambah Akun Baru"
      open={open}
      onOpenChange={setOpen}
    >
      <AccountForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

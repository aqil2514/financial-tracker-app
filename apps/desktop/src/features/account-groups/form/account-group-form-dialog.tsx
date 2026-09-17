"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { AccountGroupForm } from "./account-group-form";
import { useCreateAccountGroup } from "./use-create-account-group";

export function AccountGroupFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } =
    useCreateAccountGroup();

  return (
    <EntityFormDialog
      trigger={<Button size="sm">Tambah Group</Button>}
      title="Tambah Group Akun"
      open={open}
      onOpenChange={setOpen}
    >
      <AccountGroupForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

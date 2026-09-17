"use client";

import { Pencil } from "lucide-react";

import type { AccountGroup } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { AccountGroupForm } from "./account-group-form";
import { useUpdateAccountGroup } from "./use-update-account-group";

export function AccountGroupEditDialog({ group }: { group: AccountGroup }) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateAccountGroup(group);

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      }
      title="Edit Group Akun"
      open={open}
      onOpenChange={setOpen}
    >
      <AccountGroupForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
      />
    </EntityFormDialog>
  );
}

"use client";

import { Pencil } from "lucide-react";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { AccountForm } from "./account-form";
import { useUpdateAccount } from "./use-update-account";

export function AccountEditDialog({ account }: { account: Account }) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateAccount(account);

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      }
      title="Edit Akun"
      open={open}
      onOpenChange={setOpen}
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

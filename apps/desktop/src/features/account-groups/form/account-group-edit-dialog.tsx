"use client";

import { Pencil } from "lucide-react";

import type { AccountGroup } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountGroupForm } from "./account-group-form";
import { useUpdateAccountGroup } from "./use-update-account-group";

export function AccountGroupEditDialog({ group }: { group: AccountGroup }) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateAccountGroup(group);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <Pencil className="size-4" />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Group Akun</DialogTitle>
        </DialogHeader>
        <AccountGroupForm
          form={form}
          onSubmit={onSubmit}
          isPending={isPending}
          submitLabel="Simpan Perubahan"
        />
      </DialogContent>
    </Dialog>
  );
}

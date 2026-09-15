"use client";

import { Pencil } from "lucide-react";

import type { Account } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountForm } from "./account-form";
import { useUpdateAccount } from "./use-update-account";

export function AccountEditDialog({ account }: { account: Account }) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateAccount(account);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Akun</DialogTitle>
        </DialogHeader>
        <AccountForm
          form={form}
          onSubmit={onSubmit}
          isPending={isPending}
          submitLabel="Simpan Perubahan"
        />
      </DialogContent>
    </Dialog>
  );
}

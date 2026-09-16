"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AccountGroupForm } from "./account-group-form";
import { useCreateAccountGroup } from "./use-create-account-group";

export function AccountGroupFormDialog() {
  const { open, setOpen, form, onSubmit, isPending } =
    useCreateAccountGroup();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Tambah Group</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Group Akun</DialogTitle>
        </DialogHeader>
        <AccountGroupForm form={form} onSubmit={onSubmit} isPending={isPending} />
      </DialogContent>
    </Dialog>
  );
}

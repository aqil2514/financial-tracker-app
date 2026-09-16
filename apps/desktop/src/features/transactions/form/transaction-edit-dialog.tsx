"use client";

import { Pencil } from "lucide-react";

import type { Transaction } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";
import { useUpdateTransaction } from "./use-update-transaction";

export function TransactionEditDialog({
  transaction,
}: {
  transaction: Transaction;
}) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateTransaction(transaction);

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
          <DialogTitle>Edit Transaksi</DialogTitle>
        </DialogHeader>
        <TransactionForm
          form={form}
          onSubmit={onSubmit}
          isPending={isPending}
          submitLabel="Simpan Perubahan"
        />
      </DialogContent>
    </Dialog>
  );
}

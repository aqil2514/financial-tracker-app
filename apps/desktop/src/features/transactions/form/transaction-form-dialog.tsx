"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TransactionForm } from "./transaction-form";
import { useCreateTransaction } from "./use-create-transaction";

export function TransactionFormDialog() {
  const { open, setOpen, form, onSubmit, onSubmitAndContinue, isPending } =
    useCreateTransaction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Tambah Transaksi</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Transaksi</DialogTitle>
        </DialogHeader>
        <TransactionForm
          form={form}
          onSubmit={onSubmit}
          onSubmitAndContinue={onSubmitAndContinue}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

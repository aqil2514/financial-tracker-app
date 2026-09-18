"use client";

import { Pencil } from "lucide-react";

import type { Transaction } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
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
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Pencil className="size-4" />
        </Button>
      }
      title="Edit Transaksi"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-6xl"
    >
      <TransactionForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        submitLabel="Simpan Perubahan"
        transactionId={transaction.id}
      />
    </EntityFormDialog>
  );
}

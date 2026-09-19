"use client";

import { useEffect } from "react";
import { Pencil } from "lucide-react";

import type { Transaction } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { TransactionForm } from "./transaction-form";
import { useUpdateTransaction } from "./use-update-transaction";

export function TransactionEditDialog({
  transaction,
  /** Dikontrol dari luar (mis. item di ListItemActionsMenu) — kalau
   * diisi, tombol pensil bawaan disembunyikan dan dialog dibuka/ditutup
   * lewat pasangan `open`/`onOpenChange` ini. */
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: {
  transaction: Transaction;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { open, setOpen, form, onSubmit, isPending } =
    useUpdateTransaction(transaction);

  const isControlled = controlledOpen !== undefined;

  useEffect(() => {
    if (isControlled) setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled, controlledOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setControlledOpen?.(next);
  }

  return (
    <EntityFormDialog
      trigger={
        isControlled ? undefined : (
          <Button variant="ghost" size="icon-sm">
            <Pencil className="size-4" />
          </Button>
        )
      }
      title="Edit Transaksi"
      open={open}
      onOpenChange={handleOpenChange}
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

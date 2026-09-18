"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { KeyboardShortcutBadge } from "@/components/keyboard-shortcut-badge";
import { useCreateShortcut } from "@/hooks/use-create-shortcut";
import { TransactionForm } from "./transaction-form";
import { useCreateTransaction } from "./use-create-transaction";

export function TransactionFormDialog() {
  const { open, setOpen, form, onSubmit, onSubmitAndContinue, isPending } =
    useCreateTransaction();

  useCreateShortcut(() => setOpen(true));

  return (
    <EntityFormDialog
      trigger={
        <Button>
          Tambah Transaksi
          <KeyboardShortcutBadge shortcut="N" />
        </Button>
      }
      title="Tambah Transaksi"
      open={open}
      onOpenChange={setOpen}
    >
      <TransactionForm
        form={form}
        onSubmit={onSubmit}
        onSubmitAndContinue={onSubmitAndContinue}
        isPending={isPending}
      />
    </EntityFormDialog>
  );
}

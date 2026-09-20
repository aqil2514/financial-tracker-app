"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/entity-form-dialog";
import { NewDebtForm } from "./new-debt-form";
import { useCreateDebt } from "./use-create-debt";

/** Jalan pintas "Tambah Piutang/Utang Baru" dari halaman `/debts` — lihat
 * use-create-debt.ts untuk logic di baliknya. */
export function NewDebtDialog() {
  const { open, setOpen, form, onSubmit, isPending } = useCreateDebt();

  return (
    <EntityFormDialog
      trigger={<Button>Tambah Utang/Piutang</Button>}
      title="Tambah Utang/Piutang Baru"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-lg"
    >
      <NewDebtForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

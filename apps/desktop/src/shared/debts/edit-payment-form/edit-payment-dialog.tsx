"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { DebtPaymentRow } from "@/shared/debts/use-debt-payments";
import { EditPaymentForm } from "./edit-payment-form";
import { useEditPayment } from "./use-edit-payment";

type EditPaymentDialogProps = {
  payment: DebtPaymentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog "Edit" per baris riwayat cicilan di `PaymentsList` — pola
 * single-source-of-truth sama dengan `PayDebtDialog` (lihat catatan di
 * sana soal kenapa sinkronisasi open state harus satu arah). */
export function EditPaymentDialog({ payment, open: controlledOpen, onOpenChange }: EditPaymentDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useEditPayment(payment, () =>
    onOpenChange(false)
  );

  useEffect(() => {
    setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  return (
    <EntityFormDialog
      title="Edit Cicilan"
      open={controlledOpen}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-lg"
    >
      <EditPaymentForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { InvestmentPurchaseRow } from "../use-investment-purchases";
import { EditInvestmentPurchaseForm } from "./edit-investment-purchase-form";
import { useUpdateInvestmentPurchase } from "./use-update-investment-purchase";

type EditInvestmentPurchaseDialogProps = {
  purchase: InvestmentPurchaseRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog "Edit" per baris riwayat pembelian di `PurchaseHistoryTable` —
 * pola single-source-of-truth sama dengan `EditPaymentDialog`
 * (shared/debts/edit-payment-form/). */
export function EditInvestmentPurchaseDialog({
  purchase,
  open: controlledOpen,
  onOpenChange,
}: EditInvestmentPurchaseDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useUpdateInvestmentPurchase(purchase, () =>
    onOpenChange(false)
  );

  useEffect(() => {
    setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  return (
    <EntityFormDialog
      title="Edit Pembelian Investasi"
      open={controlledOpen}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-lg"
    >
      <EditInvestmentPurchaseForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

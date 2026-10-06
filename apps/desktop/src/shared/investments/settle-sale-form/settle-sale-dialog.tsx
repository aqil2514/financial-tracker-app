"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { InvestmentSaleRow } from "@/shared/investments/use-investment-sales";
import { SettleSaleForm } from "./settle-sale-form";
import { useSettleInvestmentSale } from "./use-settle-investment-sale";

type SettleSaleDialogProps = {
  sale: InvestmentSaleRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog "Settle" per baris penjualan pending di `SalesHistoryTable` —
 * pola single-source-of-truth sama dengan `EditInvestmentPurchaseDialog`. */
export function SettleSaleDialog({ sale, open: controlledOpen, onOpenChange }: SettleSaleDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useSettleInvestmentSale(sale, () => onOpenChange(false));

  useEffect(() => {
    setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  return (
    <EntityFormDialog
      title="Settle Penjualan Investasi"
      open={controlledOpen}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-lg"
    >
      <SettleSaleForm sale={sale} form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

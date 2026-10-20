"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { DebtListRow } from "@/shared/debts/use-debts-list";
import { CorrectDebtRemainingForm } from "./correct-debt-remaining-form";
import { useCorrectDebtRemaining } from "./use-correct-debt-remaining";

type CorrectDebtRemainingDialogProps = {
  debt: DebtListRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CorrectDebtRemainingDialog({
  debt,
  open: controlledOpen,
  onOpenChange,
}: CorrectDebtRemainingDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useCorrectDebtRemaining(debt, () =>
    onOpenChange(false)
  );

  useEffect(() => {
    setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  return (
    <EntityFormDialog
      title="Koreksi Nominal"
      open={controlledOpen}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-lg"
    >
      <CorrectDebtRemainingForm debt={debt} form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

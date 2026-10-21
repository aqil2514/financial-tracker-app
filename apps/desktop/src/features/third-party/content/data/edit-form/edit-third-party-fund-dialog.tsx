"use client";

import { useEffect } from "react";

import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import type { ThirdPartyFundRow } from "../use-third-party-funds";
import { EditThirdPartyFundForm } from "./edit-third-party-fund-form";
import { useEditThirdPartyFund } from "./use-edit-third-party-fund";

type EditThirdPartyFundDialogProps = {
  fund: ThirdPartyFundRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog "Edit" per baris riwayat Titip/Ambil di `ThirdPartyFundList` —
 * pola single-source-of-truth sama dengan `EditPaymentDialog`
 * (shared/debts/edit-payment-form/). */
export function EditThirdPartyFundDialog({
  fund,
  open: controlledOpen,
  onOpenChange,
}: EditThirdPartyFundDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useEditThirdPartyFund(fund, () =>
    onOpenChange(false)
  );

  useEffect(() => {
    setOpen(controlledOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledOpen]);

  return (
    <EntityFormDialog
      title="Edit Riwayat Titip/Ambil"
      open={controlledOpen}
      onOpenChange={onOpenChange}
      contentClassName="sm:!max-w-lg"
    >
      <EditThirdPartyFundForm form={form} onSubmit={onSubmit} isPending={isPending} />
    </EntityFormDialog>
  );
}

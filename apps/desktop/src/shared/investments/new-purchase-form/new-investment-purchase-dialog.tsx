"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { NewInvestmentPurchaseForm } from "./new-investment-purchase-form";
import { useCreateInvestmentPurchase } from "./use-create-investment-purchase";

type NewInvestmentPurchaseDialogProps = {
  /** Akun investasi tujuan — dipanggil dari header /investments/detail
   * dengan akun yang sedang dilihat, lihat use-create-investment-purchase.ts. */
  investmentAccountId: string;
};

/** Jalan pintas "Catat Pembelian Investasi" dari header halaman
 * /investments/detail — lihat use-create-investment-purchase.ts untuk
 * logic di baliknya. */
export function NewInvestmentPurchaseDialog({ investmentAccountId }: NewInvestmentPurchaseDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useCreateInvestmentPurchase({
    investmentAccountId,
  });

  return (
    <EntityFormDialog
      trigger={<Button>Catat Pembelian</Button>}
      title="Catat Pembelian Investasi"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <NewInvestmentPurchaseForm
        form={form}
        onSubmit={onSubmit}
        isPending={isPending}
        investmentAccountLocked
      />
    </EntityFormDialog>
  );
}

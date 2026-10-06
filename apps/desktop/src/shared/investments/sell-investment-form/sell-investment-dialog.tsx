"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { SellInvestmentForm } from "./sell-investment-form";
import { useCreateInvestmentSale } from "./use-create-investment-sale";

type SellInvestmentDialogProps = {
  /** Akun investasi sumber — pola PERSIS NewInvestmentPurchaseDialog
   * (investmentAccountId), dipanggil dari header /investments/detail
   * dengan akun yang sedang dilihat. */
  investmentAccountId: string;
};

/** Dialog "Jual Investasi" — pola PERSIS NewInvestmentPurchaseDialog,
 * arah sebaliknya. Lihat use-create-investment-sale.ts untuk logic di
 * baliknya. Dipasang di header /investments/detail
 * (features/investment-detail/header/index.tsx), tombol `variant="outline"`
 * (beda dari "Catat Pembelian" yang primary) — jual bukan aksi utama
 * halaman ini. */
export function SellInvestmentDialog({ investmentAccountId }: SellInvestmentDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useCreateInvestmentSale({
    investmentAccountId,
  });

  return (
    <EntityFormDialog
      trigger={<Button variant="outline">Jual Investasi</Button>}
      title="Jual Investasi"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <SellInvestmentForm form={form} onSubmit={onSubmit} isPending={isPending} investmentAccountLocked />
    </EntityFormDialog>
  );
}

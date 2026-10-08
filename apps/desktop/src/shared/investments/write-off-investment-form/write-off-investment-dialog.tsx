"use client";

import { Button } from "@/components/ui/button";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { WriteOffInvestmentForm } from "./write-off-investment-form";
import { useWriteOffInvestment } from "./use-write-off-investment";

type WriteOffInvestmentDialogProps = {
  /** Akun investasi — pola PERSIS SellInvestmentDialog
   * (investmentAccountId), dipanggil dari header /investments/detail
   * dengan akun yang sedang dilihat. */
  investmentAccountId: string;
};

/** Dialog "Write-off Unit" — catat unit yang hilang/dilepas tanpa kas
 * yang berpindah (hibah ke orang lain, delisting, biaya admin dipotong
 * dalam bentuk unit). Pola PERSIS SellInvestmentDialog, jauh lebih
 * sederhana. Lihat use-write-off-investment.ts untuk logic di baliknya.
 * Tombol `variant="outline"` (bukan primary) — write-off bukan aksi
 * utama halaman ini, sama alasan tombol "Jual Investasi". */
export function WriteOffInvestmentDialog({ investmentAccountId }: WriteOffInvestmentDialogProps) {
  const { open, setOpen, form, onSubmit, isPending } = useWriteOffInvestment({
    investmentAccountId,
  });

  return (
    <EntityFormDialog
      trigger={<Button variant="outline">Write-off Unit</Button>}
      title="Write-off Unit Investasi"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-2xl"
    >
      <WriteOffInvestmentForm form={form} onSubmit={onSubmit} isPending={isPending} investmentAccountLocked />
    </EntityFormDialog>
  );
}

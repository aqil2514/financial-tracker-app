"use client";

import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { EntityFormDialog } from "@/components/forms/entity-form-dialog";
import { FormFieldCurrency } from "@/components/forms/form-fields";
import { useUpdateMarketValue } from "./use-update-market-value";

/** Dialog kecil (1 field) untuk update `current_market_value` dari tombol
 * pensil di `InvestmentPlStats` — lihat use-update-market-value.ts untuk
 * alasan kenapa ini terpisah dari dialog "Edit Akun" penuh. */
export function UpdateMarketValueDialog({
  accountId,
  currentValue,
}: {
  accountId: string;
  currentValue: number;
}) {
  const { open, setOpen, form, onSubmit, isPending } = useUpdateMarketValue(accountId, currentValue, () =>
    setOpen(false)
  );

  return (
    <EntityFormDialog
      trigger={
        <Button variant="ghost" size="icon-xs">
          <Pencil className="size-3" />
        </Button>
      }
      title="Update Nilai Pasar Terkini"
      open={open}
      onOpenChange={setOpen}
      contentClassName="sm:!max-w-sm"
    >
      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <FormFieldCurrency form={form} name="current_market_value" label="Nilai Pasar Terkini" useCalculator />
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </form>
    </EntityFormDialog>
  );
}

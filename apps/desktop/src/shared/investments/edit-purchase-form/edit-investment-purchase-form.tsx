"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldNumber, FormFieldSelect } from "@/components/forms/form-fields";
import { PricePerUnitField } from "../price-per-unit-field";
import { PURCHASE_STATUS_LABEL } from "../purchase-status-labels";
import type { EditInvestmentPurchaseFormOutput, EditInvestmentPurchaseFormValues } from "./schema";

type EditInvestmentPurchaseFormProps = {
  form: UseFormReturn<EditInvestmentPurchaseFormValues, unknown, EditInvestmentPurchaseFormOutput>;
  onSubmit: (values: EditInvestmentPurchaseFormOutput) => void;
  isPending: boolean;
};

const STATUS_OPTIONS = Object.entries(PURCHASE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** Isi/koreksi unit & harga per unit satu baris `investment_purchases`
 * begitu settlement dikonfirmasi, lalu tandai `settled` -- lihat
 * use-update-investment-purchase.ts. */
export function EditInvestmentPurchaseForm({ form, onSubmit, isPending }: EditInvestmentPurchaseFormProps) {
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldNumber
        form={form}
        name="unit"
        label="Jumlah Unit (opsional)"
        placeholder="Kosongkan kalau belum tahu"
      />
      <PricePerUnitField form={form} name="price_per_unit" unitFieldName="unit" />
      <FormFieldSelect form={form} name="status" label="Status" options={STATUS_OPTIONS} />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

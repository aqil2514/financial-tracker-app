"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldCurrency, FormFieldDate, FormFieldText } from "@/components/forms/form-fields";
import type { EditPaymentFormOutput, EditPaymentFormValues } from "./schema";

type EditPaymentFormProps = {
  form: UseFormReturn<EditPaymentFormValues, unknown, EditPaymentFormOutput>;
  onSubmit: (values: EditPaymentFormOutput) => void;
  isPending: boolean;
};

export function EditPaymentForm({ form, onSubmit, isPending }: EditPaymentFormProps) {
  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldCurrency form={form} name="amount" label="Nominal" useCalculator />
      <FormFieldDate form={form} name="date" label="Tanggal" />
      <FormFieldText form={form} name="note" label="Catatan" placeholder="Opsional" />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

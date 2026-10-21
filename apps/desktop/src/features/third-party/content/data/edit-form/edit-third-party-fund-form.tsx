"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { FormFieldCurrency, FormFieldDate, FormFieldText } from "@/components/forms/form-fields";
import type { EditThirdPartyFundFormOutput, EditThirdPartyFundFormValues } from "./schema";

type EditThirdPartyFundFormProps = {
  form: UseFormReturn<EditThirdPartyFundFormValues, unknown, EditThirdPartyFundFormOutput>;
  onSubmit: (values: EditThirdPartyFundFormOutput) => void;
  isPending: boolean;
};

export function EditThirdPartyFundForm({ form, onSubmit, isPending }: EditThirdPartyFundFormProps) {
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

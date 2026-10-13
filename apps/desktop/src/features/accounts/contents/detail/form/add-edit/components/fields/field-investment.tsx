import { useFormContext, useWatch } from "react-hook-form";

import { FormFieldText, FormFieldCurrency } from "@/components/forms/form-fields";
import { LabelField } from "@/shared/labels/label-field";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldInvestment() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const accountType = useWatch({ control: form.control, name: "account_type" });

  if (accountType !== "investment") return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText
          form={form}
          name="unit_label"
          label="Satuan Unit"
          placeholder="Mis. unit, lembar, gram"
        />
        <FormFieldCurrency form={form} name="current_market_value" label="Nilai Pasar Terkini" />
      </div>
      <LabelField control={form.control} scope="account" label="Jenis Instrumen" />
    </>
  );
}

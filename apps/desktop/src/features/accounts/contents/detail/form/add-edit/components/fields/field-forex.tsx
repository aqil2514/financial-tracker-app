import { useFormContext, useWatch } from "react-hook-form";

import { FormFieldText, FormFieldCurrency } from "@/components/forms/form-fields";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldForex() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const accountType = useWatch({ control: form.control, name: "account_type" });

  if (accountType !== "forex") return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormFieldText form={form} name="forex_country" label="Negara" placeholder="Mis. Amerika Serikat" />
        <FormFieldText form={form} name="forex_currency" label="Mata Uang" placeholder="Mis. USD" />
      </div>
      <FormFieldCurrency form={form} name="forex_current_rate" label="Kurs Terkini (Rp per 1 unit)" />
    </>
  );
}

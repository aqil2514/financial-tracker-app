import { useFormContext, useWatch } from "react-hook-form";

import { FormFieldCurrency } from "@/components/forms/form-fields";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldInitialBalance() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const accountType = useWatch({ control: form.control, name: "account_type" });

  return (
    <FormFieldCurrency
      form={form}
      name="initial_balance"
      label="Saldo Awal"
      disabled={accountType === "third_party"}
    />
  );
}

import { useFormContext, useWatch } from "react-hook-form";

import { FormFieldToggleGroup } from "@/components/forms/form-fields";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

const debtDirectionOptions = [
  { value: "receivable", label: "Piutang saja" },
  { value: "payable", label: "Utang saja" },
  { value: "both", label: "Keduanya" },
];

export function FieldDebt() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const accountType = useWatch({ control: form.control, name: "account_type" });

  if (accountType !== "debt") return null;

  return (
    <FormFieldToggleGroup
      form={form}
      name="debt_direction"
      label="Arah"
      options={debtDirectionOptions}
    />
  );
}

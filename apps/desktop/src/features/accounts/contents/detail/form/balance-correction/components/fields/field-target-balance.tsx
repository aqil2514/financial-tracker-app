import { useFormContext } from "react-hook-form";

import { FormFieldCurrency } from "@/components/forms/form-fields";
import type {
  AccountBalanceCorrectionFormOutput,
  AccountBalanceCorrectionFormValues,
} from "../../schema";

export function FieldTargetBalance() {
  const form = useFormContext<
    AccountBalanceCorrectionFormValues,
    unknown,
    AccountBalanceCorrectionFormOutput
  >();

  return <FormFieldCurrency form={form} name="targetBalance" label="Saldo Seharusnya" />;
}

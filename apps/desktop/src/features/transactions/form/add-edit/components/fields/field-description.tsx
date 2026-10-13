import { useFormContext } from "react-hook-form";

import { FormFieldRichText } from "@/components/forms/form-fields";
import type { TransactionFormOutput, TransactionFormValues } from "../../schema";

export function FieldDescription() {
  const form = useFormContext<TransactionFormValues, unknown, TransactionFormOutput>();

  return <FormFieldRichText form={form} name="description" label="Deskripsi" />;
}

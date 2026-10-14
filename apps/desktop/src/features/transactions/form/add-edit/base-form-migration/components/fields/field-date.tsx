import { useFormContext } from "react-hook-form";

import { FormFieldDate } from "@/components/forms/form-fields";
import type { TransactionFormOutput, TransactionFormValues } from "../../schema";

export function FieldDate() {
  const form = useFormContext<TransactionFormValues, unknown, TransactionFormOutput>();

  return <FormFieldDate form={form} name="date" label="Tanggal" />;
}

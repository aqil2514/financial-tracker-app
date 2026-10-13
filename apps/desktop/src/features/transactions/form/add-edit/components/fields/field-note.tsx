import { useFormContext } from "react-hook-form";

import { FormFieldText } from "@/components/forms/form-fields";
import type { TransactionFormOutput, TransactionFormValues } from "../../schema";

export function FieldNote() {
  const form = useFormContext<TransactionFormValues, unknown, TransactionFormOutput>();

  return (
    <FormFieldText
      form={form}
      name="note"
      label="Catatan"
      placeholder="Judul singkat transaksi"
    />
  );
}

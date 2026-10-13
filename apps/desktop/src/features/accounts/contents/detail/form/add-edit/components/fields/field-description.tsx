import { useFormContext } from "react-hook-form";

import { FormFieldTextarea } from "@/components/forms/form-fields";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldDescription() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();

  return (
    <FormFieldTextarea
      form={form}
      name="description"
      label="Deskripsi"
      placeholder="Catatan tambahan tentang akun ini (opsional)"
    />
  );
}

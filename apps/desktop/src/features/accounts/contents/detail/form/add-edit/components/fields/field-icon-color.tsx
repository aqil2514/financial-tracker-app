import { useFormContext } from "react-hook-form";

import { FormFieldIconPicker, FormFieldColorPicker } from "@/components/forms/form-fields";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldIconColor() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();

  return (
    <div className="grid grid-cols-2 gap-4">
      <FormFieldIconPicker form={form} name="icon" label="Icon" />
      <FormFieldColorPicker form={form} name="color" label="Warna" />
    </div>
  );
}

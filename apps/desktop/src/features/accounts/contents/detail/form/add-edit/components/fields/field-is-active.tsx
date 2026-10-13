import { useFormContext } from "react-hook-form";

import { FormFieldToggleGroup } from "@/components/forms/form-fields";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldIsActive() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();

  return (
    <FormFieldToggleGroup
      form={form}
      name="is_active"
      label="Status"
      options={[
        { value: "1", label: "Aktif" },
        { value: "0", label: "Nonaktif" },
      ]}
    />
  );
}

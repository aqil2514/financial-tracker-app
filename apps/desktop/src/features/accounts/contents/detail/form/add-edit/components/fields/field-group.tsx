import { useFormContext } from "react-hook-form";

import { FormFieldSelect } from "@/components/forms/form-fields";
import { useAccountGroups } from "@/features/account-groups";
import type { AccountFormOutput, AccountFormValues } from "../../schema";

export function FieldGroup() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const { data: groups } = useAccountGroups();

  return (
    <FormFieldSelect
      form={form}
      name="group_id"
      label="Group Akun"
      placeholder="Pilih group..."
      allowClear
      clearLabel="Tanpa Group"
      options={
        groups?.map((group) => ({
          value: String(group.id),
          label: group.name,
        })) ?? []
      }
    />
  );
}

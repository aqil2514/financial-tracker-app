import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FormFieldSelect } from "@/components/forms/form-fields";
import { useDatabase } from "@/lib/database";
import type { AccountFormOutput, AccountFormValues } from "../schema";

type GroupOptionRow = { id: string; name: string };

export function GroupSelectField() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const db = useDatabase();
  const [options, setOptions] = useState<GroupOptionRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const rows = await db.getAllAsync<GroupOptionRow>(
        "SELECT id, name FROM account_groups ORDER BY name ASC",
      );
      if (!cancelled) setOptions(rows);
    }

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [db]);

  return (
    <FormFieldSelect
      form={form}
      name="group_id"
      label="Grup (opsional)"
      placeholder="Tanpa grup"
      allowClear
      clearLabel="Tanpa grup"
      options={options.map((option) => ({
        value: option.id,
        label: option.name,
      }))}
    />
  );
}

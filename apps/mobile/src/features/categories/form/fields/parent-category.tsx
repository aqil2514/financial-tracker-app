import { FormFieldSelect } from "@/components/forms/form-fields";
import { useDatabase } from "@/lib/database";
import { useEffect, useRef, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { CategoryFormOutput, CategoryFormValues } from "../schema";
import { ParentOptionRow } from "../../types";

export function ParentCategoryField({ excludeId }: { excludeId?: string }) {
  const form = useFormContext<CategoryFormValues, unknown, CategoryFormOutput>();
  const db = useDatabase();
  const type = useWatch({ control: form.control, name: "type" });
  const [parentOptions, setParentOptions] = useState<ParentOptionRow[]>([]);
  const isFirstRun = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function loadParentOptions() {
      const rows = await db.getAllAsync<ParentOptionRow>(
        `SELECT id, name FROM categories
         WHERE type = ? AND parent_id IS NULL AND is_active = 1 AND id != ?
         ORDER BY name ASC`,
        [type, excludeId ?? ""],
      );
      if (!cancelled) setParentOptions(rows);
    }

    loadParentOptions();
    return () => {
      cancelled = true;
    };
  }, [db, type, excludeId]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    form.setValue("parent_id", null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  return (
    <FormFieldSelect
      form={form}
      name="parent_id"
      label="Kategori Induk (opsional)"
      placeholder="Tanpa induk"
      allowClear
      clearLabel="Tanpa induk"
      options={parentOptions.map((option) => ({
        value: option.id,
        label: option.name,
      }))}
    />
  );
}

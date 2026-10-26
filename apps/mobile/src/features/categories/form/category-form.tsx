import { BaseForm } from "@/components/forms/base-form";
import { FormFieldText, FormFieldToggleGroup } from "@/components/forms/form-fields";
import { categorySchema } from "./schema";
import { ParentCategoryField } from "./fields/parent-category";
import { CategoryFormProps } from "../types";

const TYPE_OPTIONS = [
  { value: "income", label: "Pemasukan" },
  { value: "expense", label: "Pengeluaran" },
];

export function CategoryForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel,
  excludeId,
}: CategoryFormProps) {
  return (
    <BaseForm
      schema={categorySchema}
      defaultValues={defaultValues}
      onSubmit={onSubmit}
      isPending={isPending}
      submitLabel={submitLabel}
    >
      {(form) => (
        <>
          <FormFieldToggleGroup
            form={form}
            name="type"
            label="Tipe"
            options={TYPE_OPTIONS}
          />

          <FormFieldText
            form={form}
            name="name"
            label="Nama"
            placeholder="Mis. Makanan"
          />

          <ParentCategoryField excludeId={excludeId} />
        </>
      )}
    </BaseForm>
  );
}



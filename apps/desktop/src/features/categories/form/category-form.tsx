"use client";

import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldText,
  FormFieldSelect,
  FormFieldToggleGroup,
} from "@/components/form-fields";
import { useCategories } from "@/hooks/resources/use-categories";
import type { CategoryFormOutput, CategoryFormValues } from "./category.schema";

type CategoryFormProps = {
  form: UseFormReturn<CategoryFormValues, unknown, CategoryFormOutput>;
  onSubmit: (values: CategoryFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
  /** Kategori yang sedang diedit — dikecualikan dari opsi parent supaya tidak self-parent. */
  excludeId?: number;
};

export function CategoryForm({
  form,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
  excludeId,
}: CategoryFormProps) {
  const { data: categories } = useCategories();
  const type = form.watch("type");

  const parentOptions = (categories ?? [])
    .filter((category) => category.type === type)
    .filter((category) => category.id !== excludeId)
    .map((category) => ({ value: String(category.id), label: category.name }));

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldToggleGroup
        form={form}
        name="type"
        label="Tipe Kategori"
        options={[
          { value: "income", label: "Pemasukan" },
          { value: "expense", label: "Pengeluaran" },
        ]}
      />
      <FormFieldText
        form={form}
        name="name"
        label="Nama Kategori"
        placeholder="Contoh: Makanan"
      />
      <FormFieldSelect
        form={form}
        name="parent_id"
        label="Kategori Induk"
        placeholder="Pilih kategori induk..."
        allowClear
        clearLabel="Tanpa Kategori Induk"
        options={parentOptions}
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

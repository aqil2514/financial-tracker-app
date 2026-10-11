"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldText,
  FormFieldCombobox,
  FormFieldDateRange,
} from "@/components/forms/form-fields";
import { useCategories } from "@/hooks/resources/use-categories";
import { categoryPeriodSchema, type CategoryPeriodFormOutput, type CategoryPeriodFormValues } from "./schema";

type CategoryContentPeriodFormProps = {
  defaultValues: CategoryPeriodFormValues;
  onSubmit: (values: CategoryPeriodFormOutput) => void;
  isPending: boolean;
  submitLabel?: string;
};

export function CategoryContentPeriodForm({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Simpan",
}: CategoryContentPeriodFormProps) {
  const { data: categories } = useCategories();

  const form = useForm<CategoryPeriodFormValues, unknown, CategoryPeriodFormOutput>({
    resolver: zodResolver(categoryPeriodSchema),
    defaultValues,
  });

  const categoryOptions = (categories ?? []).map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldCombobox
        form={form}
        name="category_id"
        label="Kategori"
        placeholder="Cari kategori..."
        options={categoryOptions}
      />
      <FormFieldText
        form={form}
        name="name"
        label="Nama Periode"
        placeholder="Contoh: Panen 2025"
      />
      <FormFieldDateRange
        form={form}
        name="date_range"
        label="Rentang Tanggal"
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

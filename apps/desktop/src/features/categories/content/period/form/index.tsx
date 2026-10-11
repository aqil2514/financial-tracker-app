"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  FormFieldText,
  FormFieldComboboxMulti,
  FormFieldDateRange,
} from "@/components/forms/form-fields";
import { useCategories } from "@/hooks/resources/use-categories";
import {
  categoryPeriodSchema,
  type CategoryPeriodFormOutput,
  type CategoryPeriodFormValues,
} from "./schema";

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

  const form = useForm<
    CategoryPeriodFormValues,
    unknown,
    CategoryPeriodFormOutput
  >({
    resolver: zodResolver(categoryPeriodSchema),
    defaultValues,
  });

  const categoriesById = new Map(
    (categories ?? []).map((category) => [category.id, category]),
  );
  const categoryOptions = (categories ?? []).map((category) => {
    const parent = category.parent_id
      ? categoriesById.get(category.parent_id)
      : null;
    const name = parent ? `${parent.name} • ${category.name}` : category.name;
    const direction = category.type === "income" ? "Pemasukan" : "Pengeluaran";
    return {
      value: String(category.id),
      label: `[${direction}] ${name}`,
    };
  });

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <FormFieldComboboxMulti
        form={form}
        name="category_ids"
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
        description="Belum tahu kapan berakhir? Isi tanggal akhir dengan perkiraan dulu, nanti bisa diubah lagi setelah periode ini benar-benar selesai."
      />
      <DialogFooter>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

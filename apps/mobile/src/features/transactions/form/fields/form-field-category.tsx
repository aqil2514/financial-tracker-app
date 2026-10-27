import { useEffect, useRef, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { useDatabase } from "@/lib/database";
import {
  CategoryPickerSheet,
  type CategoryPickerSheetRef,
} from "@/features/categories/content/category-picker-sheet";
import type { TransactionFormValues } from "../schema";

interface FormFieldCategoryProps {
  control: Control<TransactionFormValues>;
  type: "income" | "expense";
}

export function FormFieldCategory({ control, type }: FormFieldCategoryProps) {
  return (
    <Controller
      control={control}
      name="category_id"
      render={({ field, fieldState }) => (
        <CategoryFieldInput
          value={field.value}
          error={fieldState.error?.message}
          type={type}
          onChange={field.onChange}
        />
      )}
    />
  );
}

// Field menyimpan categories.id, tapi perlu nama kategori buat
// ditampilkan — label di-cache lokal dan disinkronkan ulang dari DB tiap
// value berubah (termasuk saat defaultValues terisi dari DB di mode edit
// transaksi). Dipisah dari komponen di atas karena Controller render-prop
// bukan function component — hook harus di sini.
function CategoryFieldInput({
  value,
  error,
  type,
  onChange,
}: {
  value: string | null;
  error?: string;
  type: "income" | "expense";
  onChange: (categoryId: string) => void;
}) {
  const db = useDatabase();
  const pickerRef = useRef<CategoryPickerSheetRef>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLabel() {
      if (!value) {
        if (!cancelled) setLabel(null);
        return;
      }
      const row = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM categories WHERE id = ?",
        [value]
      );
      if (!cancelled) setLabel(row?.name ?? null);
    }

    loadLabel();
    return () => {
      cancelled = true;
    };
  }, [db, value]);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-700">Kategori</Text>
      <Pressable
        className="rounded-md border border-neutral-300 px-3 py-2"
        onPress={() => pickerRef.current?.present()}
      >
        <Text className={label ? "text-neutral-900" : "text-neutral-400"}>
          {label ?? "Pilih kategori"}
        </Text>
      </Pressable>
      <CategoryPickerSheet
        ref={pickerRef}
        type={type}
        onSelect={(category) => {
          onChange(category.id);
          setLabel(category.name);
        }}
      />
      {error && <Text className="text-sm text-red-600">{error}</Text>}
    </View>
  );
}

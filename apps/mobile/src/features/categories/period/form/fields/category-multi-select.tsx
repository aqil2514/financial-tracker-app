import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Controller, useFormContext } from "react-hook-form";
import { useDatabase } from "@/lib/database";
import { OptionPicker, type OptionPickerRef } from "@/components/query/shared/option-picker";
import type { CategoryPeriodFormOutput, CategoryPeriodFormValues } from "../schema";

interface CategoryOptionRow {
  id: string;
  name: string;
  type: "income" | "expense";
  parent_name: string | null;
}

const TYPE_PREFIX = { income: "Pemasukan", expense: "Pengeluaran" };

// Flat list lintas tipe (bukan drill-down seperti CategoryPickerSheet di
// form transaksi) — untuk assign ke periode, kategori yang dipilih
// biasanya sedikit dan lintas tipe, jadi list datar + search + checkbox
// (OptionPicker mode multiple) lebih cepat dipakai daripada browsing per
// induk. Label diberi prefix tipe + induk supaya tetap jelas konteksnya
// walau flat.
export function CategoryMultiSelectField() {
  const form = useFormContext<CategoryPeriodFormValues, unknown, CategoryPeriodFormOutput>();
  const db = useDatabase();
  const pickerRef = useRef<OptionPickerRef>(null);
  const [categories, setCategories] = useState<CategoryOptionRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      const rows = await db.getAllAsync<CategoryOptionRow>(
        `SELECT c.id, c.name, c.type, parent.name as parent_name
         FROM categories c
         LEFT JOIN categories parent ON parent.id = c.parent_id
         WHERE c.is_active = 1
         ORDER BY c.type ASC, parent.name ASC, c.name ASC`
      );
      if (!cancelled) setCategories(rows);
    }

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const options = categories.map((category) => {
    const name = category.parent_name ? `${category.parent_name} • ${category.name}` : category.name;
    return { value: category.id, label: `[${TYPE_PREFIX[category.type]}] ${name}` };
  });

  return (
    <Controller
      control={form.control}
      name="category_ids"
      render={({ field, fieldState }) => {
        const selectedLabels = options
          .filter((option) => field.value.includes(option.value))
          .map((option) => option.label);

        return (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">Kategori</Text>
            <Pressable
              className="rounded-md border border-neutral-300 px-3 py-2"
              onPress={() => pickerRef.current?.present()}
            >
              <Text className={selectedLabels.length > 0 ? "text-neutral-900" : "text-neutral-400"}>
                {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Pilih kategori"}
              </Text>
            </Pressable>
            <OptionPicker
              ref={pickerRef}
              multiple
              searchable
              title="Pilih Kategori"
              options={options}
              value={field.value}
              onSelect={field.onChange}
            />
            {fieldState.error && (
              <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
            )}
          </View>
        );
      }}
    />
  );
}

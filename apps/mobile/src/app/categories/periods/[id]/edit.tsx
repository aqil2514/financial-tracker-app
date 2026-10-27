import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { CategoryPeriodForm } from "@/features/categories/period/form/period-form";
import type {
  CategoryPeriodFormOutput,
  CategoryPeriodFormValues,
} from "@/features/categories/period/form/schema";

interface CategoryPeriodRow {
  name: string;
  start_date: string;
  end_date: string;
}

export default function EditCategoryPeriodPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<CategoryPeriodFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    async function load() {
      const period = await db.getFirstAsync<CategoryPeriodRow>(
        "SELECT name, start_date, end_date FROM category_periods WHERE id = ?",
        [id]
      );
      if (!period) return;

      const categoryRows = await db.getAllAsync<{ category_id: string }>(
        "SELECT category_id FROM category_period_categories WHERE period_id = ?",
        [id]
      );

      setDefaultValues({
        name: period.name,
        start_date: period.start_date,
        end_date: period.end_date,
        category_ids: categoryRows.map((row) => row.category_id),
      });
    }

    load();
  }, [db, id]);

  async function handleSubmit(values: CategoryPeriodFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(
        `UPDATE category_periods SET name = ?, start_date = ?, end_date = ? WHERE id = ?`,
        [values.name, values.start_date, values.end_date, id]
      );

      await db.runAsync("DELETE FROM category_period_categories WHERE period_id = ?", [id]);
      for (const categoryId of values.category_ids) {
        await db.runAsync(
          `INSERT INTO category_period_categories (id, period_id, category_id) VALUES (?, ?, ?)`,
          [generateId(), id, categoryId]
        );
      }

      router.back();
    } finally {
      setIsPending(false);
    }
  }

  function handleDelete() {
    Alert.alert("Hapus periode ini?", "Tindakan ini tidak bisa dibatalkan.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await db.runAsync("DELETE FROM category_periods WHERE id = ?", [id]);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Periode" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <CategoryPeriodForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel="Simpan Perubahan"
            onDelete={handleDelete}
          />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { CategoryPeriodForm } from "@/features/categories/period/form/period-form";
import { emptyCategoryPeriodValues } from "@/features/categories/period/form/values";
import type { CategoryPeriodFormOutput } from "@/features/categories/period/form/schema";

export default function NewCategoryPeriodPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptyCategoryPeriodValues);

  async function handleSubmit(values: CategoryPeriodFormOutput) {
    setIsPending(true);
    try {
      const periodId = generateId();
      await db.runAsync(
        `INSERT INTO category_periods (id, name, start_date, end_date) VALUES (?, ?, ?, ?)`,
        [periodId, values.name, values.start_date, values.end_date]
      );

      for (const categoryId of values.category_ids) {
        await db.runAsync(
          `INSERT INTO category_period_categories (id, period_id, category_id) VALUES (?, ?, ?)`,
          [generateId(), periodId, categoryId]
        );
      }

      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Periode" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        <CategoryPeriodForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah Periode"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

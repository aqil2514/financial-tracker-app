import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { CategoryForm } from "@/features/categories/form/category-form";
import { emptyCategoryValues } from "@/features/categories/form/values";
import type { CategoryFormOutput } from "@/features/categories/form/schema";

export default function NewCategoryPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptyCategoryValues);

  async function handleSubmit(values: CategoryFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(
        `INSERT INTO categories (id, name, type, parent_id) VALUES (?, ?, ?, ?)`,
        [generateId(), values.name, values.type, values.parent_id]
      );

      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Kategori" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        <CategoryForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah Kategori"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

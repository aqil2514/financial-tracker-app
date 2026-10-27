import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { CategoryForm } from "@/features/categories/form/category-form";
import type { CategoryFormOutput, CategoryFormValues } from "@/features/categories/form/schema";

interface CategoryRow {
  name: string;
  type: "income" | "expense";
  parent_id: string | null;
}

function toFormValues(row: CategoryRow): CategoryFormValues {
  return {
    name: row.name,
    type: row.type,
    parent_id: row.parent_id,
  };
}

export default function EditCategoryPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<CategoryFormValues | null>(null);
  const [childCount, setChildCount] = useState(0);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    db.getFirstAsync<CategoryRow>(
      "SELECT name, type, parent_id FROM categories WHERE id = ?",
      [id]
    ).then((row) => {
      if (row) setDefaultValues(toFormValues(row));
    });
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) as count FROM categories WHERE parent_id = ?",
      [id]
    ).then((row) => setChildCount(row?.count ?? 0));
  }, [db, id]);

  async function handleSubmit(values: CategoryFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(
        `UPDATE categories SET name = ?, type = ?, parent_id = ? WHERE id = ?`,
        [values.name, values.type, values.parent_id, id]
      );
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  async function deleteCategory(cascadeToChildren: boolean) {
    if (cascadeToChildren) {
      await db.runAsync("DELETE FROM categories WHERE parent_id = ?", [id]);
    }
    // Tanpa cascade: anak-anak otomatis jadi top-level lewat
    // ON DELETE SET NULL di parent_id (lihat migrasi 0003_categories.ts).
    await db.runAsync("DELETE FROM categories WHERE id = ?", [id]);
    router.back();
  }

  function handleDelete() {
    if (childCount === 0) {
      Alert.alert("Hapus kategori ini?", "Tindakan ini tidak bisa dibatalkan.", [
        { text: "Batal", style: "cancel" },
        { text: "Hapus", style: "destructive", onPress: () => deleteCategory(false) },
      ]);
      return;
    }

    Alert.alert(
      "Hapus kategori ini?",
      `Kategori ini masih punya ${childCount} sub-kategori. Pilih apa yang terjadi pada sub-kategorinya.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Lepas Sub-kategori & Hapus",
          onPress: () => deleteCategory(false),
        },
        {
          text: "Hapus Beserta Sub-kategori",
          style: "destructive",
          onPress: () => deleteCategory(true),
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Kategori" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <CategoryForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel="Simpan Perubahan"
            excludeId={id}
            onDelete={handleDelete}
          />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

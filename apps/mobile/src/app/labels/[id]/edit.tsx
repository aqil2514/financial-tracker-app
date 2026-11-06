import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { LabelForm } from "@/features/labels/form/label-form";
import type { LabelFormOutput, LabelFormValues } from "@/features/labels/form/schema";
import { DUPLICATE_LABEL_MESSAGE, isLabelNameTaken } from "@/features/labels/save-label";

export default function EditLabelPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<LabelFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    db.getFirstAsync<LabelFormValues>("SELECT name, scope FROM labels WHERE id = ?", [id]).then(
      (row) => {
        if (row) setDefaultValues(row);
      }
    );
  }, [db, id]);

  async function handleSubmit(values: LabelFormOutput) {
    setIsPending(true);
    setError(null);
    try {
      if (await isLabelNameTaken(db, values, id)) {
        setError(DUPLICATE_LABEL_MESSAGE);
        return;
      }
      await db.runAsync(`UPDATE labels SET name = ? WHERE id = ?`, [values.name, id]);
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  function handleDelete() {
    Alert.alert("Hapus label ini?", "Tindakan ini tidak bisa dibatalkan.", [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          await db.runAsync("DELETE FROM labels WHERE id = ?", [id]);
          router.back();
        },
      },
    ]);
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Label" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <LabelForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel="Simpan Perubahan"
            onDelete={handleDelete}
            lockScope
            error={error}
          />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

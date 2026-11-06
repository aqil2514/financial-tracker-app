import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { LabelForm } from "@/features/labels/form/label-form";
import { emptyLabelValues } from "@/features/labels/form/values";
import type { LabelFormOutput } from "@/features/labels/form/schema";
import { DUPLICATE_LABEL_MESSAGE, isLabelNameTaken } from "@/features/labels/save-label";

export default function NewLabelPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultValues] = useState(emptyLabelValues);

  async function handleSubmit(values: LabelFormOutput) {
    setIsPending(true);
    setError(null);
    try {
      if (await isLabelNameTaken(db, values)) {
        setError(DUPLICATE_LABEL_MESSAGE);
        return;
      }
      await db.runAsync(`INSERT INTO labels (id, name, scope) VALUES (?, ?, ?)`, [
        generateId(),
        values.name,
        values.scope,
      ]);
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Label" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        <LabelForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah Label"
          error={error}
        />
      </KeyboardAwareScrollView>
    </>
  );
}

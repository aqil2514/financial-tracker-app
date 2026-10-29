import { useState } from "react";
import { Stack, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { generateId, useDatabase } from "@/lib/database";
import { ContactForm } from "@/features/contacts/form/contact-form";
import { emptyContactValues } from "@/features/contacts/form/values";
import type { ContactFormOutput } from "@/features/contacts/form/schema";

export default function NewContactPage() {
  const router = useRouter();
  const db = useDatabase();
  const [isPending, setIsPending] = useState(false);
  const [defaultValues] = useState(emptyContactValues);

  async function handleSubmit(values: ContactFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(`INSERT INTO contacts (id, name, note) VALUES (?, ?, ?)`, [
        generateId(),
        values.name,
        values.note,
      ]);

      router.back();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Tambah Kontak" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        <ContactForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isPending={isPending}
          submitLabel="Tambah Kontak"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

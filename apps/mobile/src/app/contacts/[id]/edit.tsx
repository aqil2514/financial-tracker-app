import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useDatabase } from "@/lib/database";
import { ContactForm } from "@/features/contacts/form/contact-form";
import type { ContactFormOutput, ContactFormValues } from "@/features/contacts/form/schema";

interface ContactRow {
  name: string;
  note: string | null;
}

function toFormValues(row: ContactRow): ContactFormValues {
  return {
    name: row.name,
    note: row.note,
  };
}

export default function EditContactPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();
  const [defaultValues, setDefaultValues] = useState<ContactFormValues | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    db.getFirstAsync<ContactRow>("SELECT name, note FROM contacts WHERE id = ?", [id]).then(
      (row) => {
        if (row) setDefaultValues(toFormValues(row));
      }
    );
  }, [db, id]);

  async function handleSubmit(values: ContactFormOutput) {
    setIsPending(true);
    try {
      await db.runAsync(`UPDATE contacts SET name = ?, note = ? WHERE id = ?`, [
        values.name,
        values.note,
        id,
      ]);
      router.back();
    } finally {
      setIsPending(false);
    }
  }

  function handleDelete() {
    Alert.alert(
      "Hapus kontak ini?",
      "Riwayat piutang/utang yang terkait kontak ini TIDAK ikut terhapus, cuma kehilangan tautan nama kontaknya. Tindakan ini tidak bisa dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            await db.runAsync("DELETE FROM contacts WHERE id = ?", [id]);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Edit Kontak" }} />
      <KeyboardAwareScrollView
        className="flex-1 bg-white"
        contentContainerClassName="p-4 pb-12"
        bottomOffset={20}
      >
        {defaultValues && (
          <ContactForm
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

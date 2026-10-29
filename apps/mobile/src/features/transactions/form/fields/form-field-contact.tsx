import { useEffect, useRef, useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { useDatabase } from "@/lib/database";
import {
  ContactPickerSheet,
  type ContactPickerSheetRef,
} from "@/features/contacts/content/contact-picker-sheet";
import type { TransactionFormValues } from "../schema";

interface FormFieldContactProps {
  control: Control<TransactionFormValues>;
  disabled?: boolean;
}

export function FormFieldContact({ control, disabled }: FormFieldContactProps) {
  return (
    <Controller
      control={control}
      name="contact_id"
      render={({ field, fieldState }) => (
        <ContactFieldInput
          value={field.value}
          error={fieldState.error?.message}
          disabled={disabled}
          onChange={field.onChange}
        />
      )}
    />
  );
}

function ContactFieldInput({
  value,
  error,
  disabled,
  onChange,
}: {
  value: string | null;
  error?: string;
  disabled?: boolean;
  onChange: (contactId: string) => void;
}) {
  const db = useDatabase();
  const pickerRef = useRef<ContactPickerSheetRef>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLabel() {
      if (!value) {
        if (!cancelled) setLabel(null);
        return;
      }
      const row = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM contacts WHERE id = ?",
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
      <Text className="text-sm font-medium text-neutral-700">Kontak</Text>
      <Pressable
        className="rounded-md border border-neutral-300 px-3 py-2 disabled:opacity-50"
        disabled={disabled}
        onPress={() => pickerRef.current?.present()}
      >
        <Text className={label ? "text-neutral-900" : "text-neutral-400"}>
          {label ?? "Pilih kontak"}
        </Text>
      </Pressable>
      <ContactPickerSheet
        ref={pickerRef}
        onSelect={(contact) => {
          onChange(contact.id);
          setLabel(contact.name);
        }}
      />
      {error && <Text className="text-sm text-red-600">{error}</Text>}
    </View>
  );
}

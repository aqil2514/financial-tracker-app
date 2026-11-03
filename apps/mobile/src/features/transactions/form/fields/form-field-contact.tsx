import { useEffect, useRef, useState } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { useDatabase } from "@/lib/database";
import {
  ContactPickerSheet,
  type ContactPickerSheetRef,
} from "@/features/contacts/content/contact-picker-sheet";

// Generik supaya bisa dipakai dua kali dalam satu form (mis. kontak asal/tujuan di form pindah dana pihak ketiga).
interface FormFieldContactProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name?: Path<TFieldValues>;
  label?: string;
  disabled?: boolean;
}

export function FormFieldContact<TFieldValues extends FieldValues>({
  control,
  name = "contact_id" as Path<TFieldValues>,
  label = "Kontak",
  disabled,
}: FormFieldContactProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <ContactFieldInput
          label={label}
          value={field.value ?? null}
          error={fieldState.error?.message}
          disabled={disabled}
          onChange={field.onChange}
        />
      )}
    />
  );
}

function ContactFieldInput({
  label: fieldLabel,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
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
      <Text className="text-sm font-medium text-neutral-700">{fieldLabel}</Text>
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

import { useState } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { descriptionToPlainText, plainTextToDescription } from "@/lib/utils";

type FormFieldDescriptionProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
};

// Teks mentah disimpan di state lokal supaya normalisasi JSON tidak
// mengubah apa yang sedang diketik; form menerima TipTap JSON.
function DescriptionInput({
  label,
  value,
  onChange,
  onBlur,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  onBlur: () => void;
}) {
  const [text, setText] = useState(() => descriptionToPlainText(value));

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-700">{label}</Text>
      <TextInput
        value={text}
        onChangeText={(next) => {
          setText(next);
          onChange(plainTextToDescription(next));
        }}
        onBlur={onBlur}
        placeholder={'Catatan tambahan (awali baris dengan "- " untuk daftar)'}
        multiline
        textAlignVertical="top"
        className="min-h-24 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
      />
    </View>
  );
}

export function FormFieldDescription<TFieldValues extends FieldValues>({
  form,
  name,
  label,
}: FormFieldDescriptionProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <DescriptionInput
          label={label}
          value={field.value ?? null}
          onChange={field.onChange}
          onBlur={field.onBlur}
        />
      )}
    />
  );
}

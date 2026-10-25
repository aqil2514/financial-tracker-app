import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Text, TextInput, View } from "react-native";

type FormFieldNumberProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
};

export function FormFieldNumber<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  disabled,
}: FormFieldNumberProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">{label}</Text>
          <TextInput
            keyboardType="numeric"
            value={field.value != null ? String(field.value) : ""}
            onChangeText={(text) => field.onChange(text === "" ? null : text)}
            onBlur={field.onBlur}
            placeholder={placeholder}
            editable={!disabled}
            className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          />
          {fieldState.error && (
            <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
          )}
        </View>
      )}
    />
  );
}

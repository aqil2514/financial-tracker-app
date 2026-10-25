import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Text, TextInput, View } from "react-native";

type FormFieldTextProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  disabled?: boolean;
};

export function FormFieldText<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  secureTextEntry,
  disabled,
}: FormFieldTextProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">{label}</Text>
          <TextInput
            value={field.value ?? ""}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            secureTextEntry={secureTextEntry}
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

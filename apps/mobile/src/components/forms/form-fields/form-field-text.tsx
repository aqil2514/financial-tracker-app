import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Text, TextInput, View } from "react-native";
import { BottomSheetTextInput } from "@gorhom/bottom-sheet";

type FormFieldTextProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  disabled?: boolean;
  multiline?: boolean;
  // TextInput biasa tidak ter-track oleh sistem keyboard-avoidance
  // @gorhom/bottom-sheet (butuh handleOnFocus/handleOnBlur manual) —
  // field di dalam BottomSheetModal/BottomSheetScrollView WAJIB pakai
  // BottomSheetTextInput, kalau tidak keyboard menutupi field saat
  // sheet tidak bisa meluas otomatis mengikuti fokus.
  inBottomSheet?: boolean;
};

export function FormFieldText<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  secureTextEntry,
  disabled,
  multiline,
  inBottomSheet,
}: FormFieldTextProps<TFieldValues>) {
  const Input = inBottomSheet ? BottomSheetTextInput : TextInput;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">{label}</Text>
          <Input
            value={field.value ?? ""}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={placeholder}
            secureTextEntry={secureTextEntry}
            editable={!disabled}
            multiline={multiline}
            textAlignVertical={multiline ? "top" : "center"}
            className={
              multiline
                ? "min-h-24 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
                : "rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
            }
          />
          {fieldState.error && (
            <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
          )}
        </View>
      )}
    />
  );
}

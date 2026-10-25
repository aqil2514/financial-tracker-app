import { useRef } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { OptionPicker, type OptionPickerRef } from "@/components/query/shared/option-picker";

type FormFieldSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type FormFieldSelectProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  options: FormFieldSelectOption[];
  allowClear?: boolean;
  clearLabel?: string;
  disabled?: boolean;
};

// Reuse OptionPicker (dibangun untuk components/query/filters) sebagai
// UI pilihnya — bukan dari port desktop (yang pakai <Select> Radix),
// konsisten dengan pola "nested bottom sheet" yang sudah dipakai lintas
// komponen pilih-dari-daftar di mobile.
export function FormFieldSelect<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder = "Pilih...",
  options,
  allowClear = false,
  clearLabel = "Tanpa pilihan",
  disabled = false,
}: FormFieldSelectProps<TFieldValues>) {
  const pickerRef = useRef<OptionPickerRef>(null);

  const pickerOptions = allowClear
    ? [{ value: "", label: clearLabel }, ...options]
    : options;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = options.find((option) => option.value === field.value);

        return (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">{label}</Text>
            <Pressable
              className="rounded-md border border-neutral-300 px-3 py-2 disabled:opacity-50"
              disabled={disabled}
              onPress={() => pickerRef.current?.present()}
            >
              <Text className={selected ? "text-neutral-900" : "text-neutral-400"}>
                {selected?.label ?? placeholder}
              </Text>
            </Pressable>
            <OptionPicker
              ref={pickerRef}
              title={label}
              options={pickerOptions}
              value={field.value ?? null}
              onSelect={(value) => field.onChange(value === "" ? null : value)}
            />
            {selected?.description && (
              <Text className="text-sm text-neutral-500">{selected.description}</Text>
            )}
            {fieldState.error && (
              <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
            )}
          </View>
        );
      }}
    />
  );
}

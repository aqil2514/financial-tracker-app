import { useRef } from "react";
import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { NumpadCalculator } from "./numpad-calculator";

type FormFieldNumberProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label: string;
  placeholder?: string;
  prefix?: string;
  disabled?: boolean;
  grouped?: boolean;
  useCalculator?: boolean;
  inBottomSheet?: boolean;
};

function toDigitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

function formatGrouped(digits: string): string {
  if (digits === "") return "";
  return Number(digits).toLocaleString("id-ID");
}

export function FormFieldNumber<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  prefix,
  disabled,
  grouped,
  useCalculator,
  inBottomSheet,
}: FormFieldNumberProps<TFieldValues>) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const Input = inBottomSheet ? BottomSheetTextInput : TextInput;

  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => {
        const rawValue = field.value != null ? String(field.value) : "";
        const displayValue = grouped ? formatGrouped(rawValue) : rawValue;

        return (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">{label}</Text>
            <View className="flex-row items-center rounded-md border border-neutral-300">
              {prefix && <Text className="pl-3 text-neutral-500">{prefix}</Text>}
              <Input
                keyboardType="numeric"
                value={displayValue}
                onChangeText={(text) => {
                  const next = grouped ? toDigitsOnly(text) : text;
                  field.onChange(next === "" ? null : next);
                }}
                onBlur={field.onBlur}
                placeholder={placeholder}
                editable={!disabled}
                selectTextOnFocus
                className="flex-1 px-3 py-2 text-neutral-900"
              />
              {useCalculator && (
                <Pressable
                  className="px-3 py-2 disabled:opacity-40"
                  disabled={disabled}
                  onPress={() => sheetRef.current?.present()}
                >
                  <Ionicons name="calculator-outline" size={20} color="#737373" />
                </Pressable>
              )}
            </View>
            {fieldState.error && (
              <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
            )}

            {useCalculator && (
              <BottomSheetModal
                ref={sheetRef}
                snapPoints={["55%"]}
                enableDynamicSizing={false}
                stackBehavior="push"
                backdropComponent={(props) => (
                  <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
                )}
              >
                <BottomSheetView className="flex-1 px-4 pb-4">
                  <Text className="mb-2 text-lg font-semibold text-neutral-900">{label}</Text>
                  <NumpadCalculator
                    initialValue={rawValue}
                    onSubmit={(value) => {
                      field.onChange(String(Math.round(value)));
                      sheetRef.current?.dismiss();
                    }}
                  />
                </BottomSheetView>
              </BottomSheetModal>
            )}
          </View>
        );
      }}
    />
  );
}

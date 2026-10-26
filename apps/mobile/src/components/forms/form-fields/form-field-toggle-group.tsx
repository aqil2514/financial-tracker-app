import { Controller, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Pressable, Text, View } from "react-native";

type FormFieldToggleGroupOption = {
  value: string;
  label: string;
};

type FormFieldToggleGroupProps<TFieldValues extends FieldValues> = {
  form: UseFormReturn<TFieldValues>;
  name: FieldPath<TFieldValues>;
  label?: string;
  options: FormFieldToggleGroupOption[];
  disabled?: boolean;
};

export function FormFieldToggleGroup<TFieldValues extends FieldValues>({
  form,
  name,
  label,
  options,
  disabled,
}: FormFieldToggleGroupProps<TFieldValues>) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <View className="gap-2">
          {label && <Text className="text-sm font-medium text-neutral-700">{label}</Text>}
          <View className="flex-row gap-2">
            {options.map((option) => {
              const isActive = field.value === option.value;
              return (
                <Pressable
                  key={option.value}
                  className={
                    isActive
                      ? "flex-1 items-center rounded-md border border-neutral-900 bg-neutral-900 py-2.5"
                      : "flex-1 items-center rounded-md border border-neutral-300 py-2.5"
                  }
                  disabled={disabled}
                  onPress={() => field.onChange(option.value)}
                >
                  <Text className={isActive ? "font-medium text-white" : "text-neutral-900"}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {fieldState.error && (
            <Text className="text-sm text-red-600">{fieldState.error.message}</Text>
          )}
        </View>
      )}
    />
  );
}

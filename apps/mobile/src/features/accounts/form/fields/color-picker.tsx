import { Controller, useFormContext } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { ACCOUNT_COLOR_NAMES, ACCOUNT_COLORS } from "@/lib/account-colors";
import type { AccountFormOutput, AccountFormValues } from "../schema";

export function ColorPickerField() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();

  return (
    <Controller
      control={form.control}
      name="color"
      render={({ field }) => (
        <View className="gap-2">
          <Text className="text-sm font-medium text-neutral-700">Warna</Text>
          <View className="flex-row flex-wrap gap-2">
            {ACCOUNT_COLOR_NAMES.map((colorName) => {
              const selected = field.value === colorName;
              const { hex, label } = ACCOUNT_COLORS[colorName];

              return (
                <Pressable
                  key={colorName}
                  accessibilityLabel={label}
                  className={
                    selected
                      ? "size-9 items-center justify-center rounded-full border-2 border-neutral-900"
                      : "size-9 items-center justify-center rounded-full border-2 border-transparent"
                  }
                  onPress={() => field.onChange(colorName)}
                >
                  <View className="size-7 rounded-full" style={{ backgroundColor: hex }} />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}

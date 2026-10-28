import { createElement, useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { ACCOUNT_ICON_NAMES, resolveAccountIcon } from "@/lib/account-icons";
import type { AccountFormOutput, AccountFormValues } from "../schema";

export function IconPickerField() {
  const form = useFormContext<AccountFormValues, unknown, AccountFormOutput>();
  const sheetRef = useRef<BottomSheetModal>(null);

  return (
    <Controller
      control={form.control}
      name="icon"
      render={({ field }) => {
        const SelectedIcon = resolveAccountIcon(field.value ?? null);

        return (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">Icon</Text>
            <Pressable
              className="flex-row items-center gap-2 self-start rounded-md border border-neutral-300 px-3 py-2"
              onPress={() => sheetRef.current?.present()}
            >
              {createElement(SelectedIcon, { size: 18, color: "#171717" })}
              <Text className="text-neutral-900">{field.value ?? "Pilih icon..."}</Text>
            </Pressable>

            <BottomSheetModal
              ref={sheetRef}
              snapPoints={["50%"]}
              enableDynamicSizing={false}
              stackBehavior="push"
              backdropComponent={(props) => (
                <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
              )}
            >
              <BottomSheetView className="flex-1 px-4 pb-4">
                <Text className="mb-2 text-lg font-semibold text-neutral-900">Pilih Icon</Text>
                <View className="flex-row flex-wrap gap-2">
                  {ACCOUNT_ICON_NAMES.map((iconName) => {
                    const OptionIcon = resolveAccountIcon(iconName);
                    const selected = field.value === iconName;

                    return (
                      <Pressable
                        key={iconName}
                        className={
                          selected
                            ? "items-center justify-center rounded-md bg-neutral-900 p-3"
                            : "items-center justify-center rounded-md border border-neutral-300 p-3"
                        }
                        onPress={() => {
                          field.onChange(iconName);
                          sheetRef.current?.dismiss();
                        }}
                      >
                        {createElement(OptionIcon, { size: 20, color: selected ? "white" : "#171717" })}
                      </Pressable>
                    );
                  })}
                </View>
              </BottomSheetView>
            </BottomSheetModal>
          </View>
        );
      }}
    />
  );
}

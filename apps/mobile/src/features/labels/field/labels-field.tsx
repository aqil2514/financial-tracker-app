import { useRef } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { LabelScope } from "../types";
import { LabelPickerSheet, type LabelPickerSheetRef } from "./label-picker-sheet";

type FormWithLabels = { label_names: string[] };

interface LabelsFieldProps {
  scope: LabelScope;
  label?: string;
}

// Field `label_names` (array NAMA, bukan id): nama jadi id dan label baru dibuat saat submit lewat applyEntityLabels.
export function LabelsField({ scope, label = "Label (opsional)" }: LabelsFieldProps) {
  const { control } = useFormContext<FormWithLabels>();
  const pickerRef = useRef<LabelPickerSheetRef>(null);

  return (
    <Controller
      control={control}
      name="label_names"
      render={({ field }) => {
        const names = field.value ?? [];
        return (
          <View className="gap-2">
            <Text className="text-sm font-medium text-neutral-700">{label}</Text>
            <Pressable
              className="flex-row flex-wrap items-center gap-2 rounded-md border border-neutral-300 px-3 py-2"
              onPress={() => pickerRef.current?.present()}
            >
              {names.length === 0 ? (
                <Text className="text-neutral-400">Tanpa label</Text>
              ) : (
                names.map((name) => (
                  <View key={name} className="flex-row items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1">
                    <Ionicons name="pricetag-outline" size={12} color="#525252" />
                    <Text className="text-sm text-neutral-800">{name}</Text>
                  </View>
                ))
              )}
            </Pressable>
            <LabelPickerSheet ref={pickerRef} scope={scope} selected={names} onChange={field.onChange} />
          </View>
        );
      }}
    />
  );
}

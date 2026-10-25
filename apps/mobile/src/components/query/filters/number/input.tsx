import { BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { Pressable, Text, View } from "react-native";
import type { FilterRangeValue } from "../filter.interface";

export interface FilterNumberInputProps {
  isRange: boolean;
  value: number | null;
  rangeValue: FilterRangeValue;
  onValueChange: (value: number | null) => void;
  onRangeChange: (value: FilterRangeValue) => void;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

function toNumberOrNull(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export function FilterNumberInput({
  isRange,
  value,
  rangeValue,
  onValueChange,
  onRangeChange,
  disabled,
  clearable,
  onClear,
}: FilterNumberInputProps) {
  const handleSingleChange = (text: string) => {
    onValueChange(toNumberOrNull(text));
  };

  const handleFromChange = (text: string) => {
    onRangeChange({ ...rangeValue, from: toNumberOrNull(text) });
  };

  const handleToChange = (text: string) => {
    onRangeChange({ ...rangeValue, to: toNumberOrNull(text) });
  };

  return (
    <View className="flex-row items-center gap-1">
      {isRange ? (
        <View className="flex-1 flex-row items-center gap-1">
          <BottomSheetTextInput
            keyboardType="numeric"
            value={rangeValue.from != null ? String(rangeValue.from) : ""}
            editable={!disabled}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
            placeholder="Dari"
            onChangeText={handleFromChange}
          />
          <Text className="text-xs text-neutral-500">s/d</Text>
          <BottomSheetTextInput
            keyboardType="numeric"
            value={rangeValue.to != null ? String(rangeValue.to) : ""}
            editable={!disabled}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
            placeholder="Sampai"
            onChangeText={handleToChange}
          />
        </View>
      ) : (
        <BottomSheetTextInput
          keyboardType="numeric"
          value={value != null ? String(value) : ""}
          editable={!disabled}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-neutral-900"
          placeholder="Masukkan nilai"
          onChangeText={handleSingleChange}
        />
      )}
      {clearable && (
        <Pressable className="rounded-md border border-neutral-300 px-3 py-2" onPress={onClear}>
          <Text className="text-neutral-900">×</Text>
        </Pressable>
      )}
    </View>
  );
}

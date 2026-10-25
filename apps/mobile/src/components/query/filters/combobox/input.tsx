import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { OptionPicker, type OptionPickerRef } from "../../shared/option-picker";
import type { SelectOption } from "../filter.interface";

interface FilterComboboxInputProps {
  value: string[];
  options: SelectOption[];
  disabled?: boolean;
  onValueChange: (value: string[]) => void;
  onClear?: () => void;
}

export function FilterComboboxInput({
  value,
  options,
  disabled,
  onValueChange,
  onClear,
}: FilterComboboxInputProps) {
  const pickerRef = useRef<OptionPickerRef>(null);
  const selectedLabels = options.filter((opt) => value.includes(opt.value)).map((opt) => opt.label);

  return (
    <Pressable
      className="flex-row items-center justify-between rounded-md border border-neutral-300 px-3 py-2"
      disabled={disabled}
      onPress={() => pickerRef.current?.present()}
    >
      <Text className="flex-1 text-neutral-900" numberOfLines={1}>
        {selectedLabels.length > 0 ? selectedLabels.join(", ") : "Cari nilai..."}
      </Text>
      {value.length > 0 && (
        <Pressable onPress={onClear} hitSlop={8}>
          <Text className="px-2 text-neutral-500">×</Text>
        </Pressable>
      )}
      <OptionPicker
        ref={pickerRef}
        multiple
        searchable
        title="Pilih Nilai"
        options={options}
        value={value}
        onSelect={onValueChange}
      />
    </Pressable>
  );
}

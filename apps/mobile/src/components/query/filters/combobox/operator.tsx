import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { OptionPicker, type OptionPickerRef } from "../../shared/option-picker";
import type { SelectOperatorType } from "../filter.interface";

interface FilterOperatorComboboxProps {
  value: SelectOperatorType;
  onChange: (value: SelectOperatorType) => void;
}

const COMBOBOX_OPERATOR_OPTIONS: { value: SelectOperatorType; label: string }[] = [
  { value: "eq", label: "Adalah" },
  { value: "neq", label: "Bukan" },
  { value: "is_null", label: "Kosong" },
  { value: "is_not_null", label: "Tidak kosong" },
];

export function FilterOperatorCombobox({ value, onChange }: FilterOperatorComboboxProps) {
  const pickerRef = useRef<OptionPickerRef>(null);
  const activeLabel = COMBOBOX_OPERATOR_OPTIONS.find((op) => op.value === value)?.label;

  return (
    <>
      <Pressable
        className="rounded-md border border-neutral-300 px-3 py-2"
        onPress={() => pickerRef.current?.present()}
      >
        <Text className="text-neutral-900">{activeLabel ?? "Operator"}</Text>
      </Pressable>
      <OptionPicker
        ref={pickerRef}
        title="Pilih Operator"
        options={COMBOBOX_OPERATOR_OPTIONS}
        value={value}
        onSelect={(val) => onChange(val as SelectOperatorType)}
      />
    </>
  );
}

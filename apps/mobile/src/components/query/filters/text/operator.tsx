import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { OptionPicker, type OptionPickerRef } from "../../shared/option-picker";
import type { TextOperatorType } from "../filter.interface";

interface FilterOperatorTextProps {
  value: TextOperatorType;
  onChange: (value: TextOperatorType) => void;
}

const TEXT_OPERATOR_OPTIONS: { value: TextOperatorType; label: string }[] = [
  { value: "ilike", label: "Berisi kata" },
  { value: "not_ilike", label: "Tidak berisi kata" },
  { value: "is_null", label: "Kosong" },
  { value: "is_not_null", label: "Tidak kosong" },
];

export function FilterOperatorText({ value, onChange }: FilterOperatorTextProps) {
  const pickerRef = useRef<OptionPickerRef>(null);
  const activeLabel = TEXT_OPERATOR_OPTIONS.find((op) => op.value === value)?.label;

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
        options={TEXT_OPERATOR_OPTIONS}
        value={value}
        onSelect={(val) => onChange(val as TextOperatorType)}
      />
    </>
  );
}

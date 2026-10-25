import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { OptionPicker, type OptionPickerRef } from "../../shared/option-picker";
import type { NumberOperatorType } from "../filter.interface";

const NUMBER_OPERATOR_OPTIONS: { value: NumberOperatorType; label: string }[] = [
  { value: "eq", label: "Sama dengan" },
  { value: "neq", label: "Tidak sama dengan" },
  { value: "gt", label: "Lebih besar dari" },
  { value: "gte", label: "Lebih besar atau sama dengan" },
  { value: "lt", label: "Lebih kecil dari" },
  { value: "lte", label: "Lebih kecil atau sama dengan" },
  { value: "between", label: "Di antara" },
  { value: "not_between", label: "Tidak di antara" },
  { value: "is_null", label: "Kosong" },
  { value: "is_not_null", label: "Tidak kosong" },
];

export function FilterOperatorNumber({
  value,
  onChange,
}: {
  value: NumberOperatorType;
  onChange: (value: NumberOperatorType) => void;
}) {
  const pickerRef = useRef<OptionPickerRef>(null);
  const activeLabel = NUMBER_OPERATOR_OPTIONS.find((op) => op.value === value)?.label;

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
        options={NUMBER_OPERATOR_OPTIONS}
        value={value}
        onSelect={(val) => onChange(val as NumberOperatorType)}
      />
    </>
  );
}

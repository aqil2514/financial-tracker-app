import { useRef } from "react";
import { Pressable, Text } from "react-native";
import { OptionPicker, type OptionPickerRef } from "../../shared/option-picker";
import type { FilterKeyOption } from "../panel/panel.interface";

interface FilterKeySelectorProps {
  value: string;
  keyOptions: FilterKeyOption[];
  onChange: (filterKey: string) => void;
}

// Key-selector dipakai sama di semua tipe field (text/select/number/
// combobox) — disatukan di sini supaya tidak diduplikasi di tiap
// orchestrator, beda dengan desktop yang menulis <Select> field ini
// berulang di text/index.tsx, select/index.tsx, dst (karena Radix
// <Select> ringan untuk diulang inline, OptionPicker di mobile tidak).
export function FilterKeySelector({ value, keyOptions, onChange }: FilterKeySelectorProps) {
  const pickerRef = useRef<OptionPickerRef>(null);
  const activeLabel = keyOptions.find((opt) => opt.key === value)?.label;

  return (
    <>
      <Pressable
        className="rounded-md border border-neutral-300 px-3 py-2"
        onPress={() => pickerRef.current?.present()}
      >
        <Text className="text-neutral-900">{activeLabel ?? "Pilih field"}</Text>
      </Pressable>
      <OptionPicker
        ref={pickerRef}
        title="Pilih Field"
        options={keyOptions.map((opt) => ({ value: opt.key, label: opt.label }))}
        value={value}
        onSelect={onChange}
      />
    </>
  );
}

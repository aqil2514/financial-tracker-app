"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { RETAILKU_TOOLS } from "../../registry";

type ToolOption = { value: string; label: string };

const TOOL_OPTIONS: ToolOption[] = Object.entries(RETAILKU_TOOLS).map(([value, entry]) => ({
  value,
  label: entry.label,
}));

export function ToolPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const selected = TOOL_OPTIONS.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={TOOL_OPTIONS}
      value={selected}
      onValueChange={(next: ToolOption | null) => onChange(next?.value ?? null)}
    >
      <ComboboxInput placeholder="Pilih tools..." />
      <ComboboxContent>
        <ComboboxEmpty>Tidak ditemukan.</ComboboxEmpty>
        <ComboboxList>
          {(item: ToolOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

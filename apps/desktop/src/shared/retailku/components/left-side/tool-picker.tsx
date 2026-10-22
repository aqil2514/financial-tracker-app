"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export const DUMMY_TOOLS = [
  { value: "get_fund_transfer_list", label: "Transfer Dana" },
  { value: "get_cashflow_detail", label: "Kas Harian" },
  { value: "get_ar_ap", label: "Piutang/Utang Dagang" },
];

export function ToolPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <Combobox items={DUMMY_TOOLS} value={value} onValueChange={(next) => onChange(next as string | null)}>
      <ComboboxInput placeholder="Pilih tools..." />
      <ComboboxContent>
        <ComboboxEmpty>Tidak ditemukan.</ComboboxEmpty>
        <ComboboxList>
          {(item: (typeof DUMMY_TOOLS)[number]) => (
            <ComboboxItem key={item.value} value={item.value}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

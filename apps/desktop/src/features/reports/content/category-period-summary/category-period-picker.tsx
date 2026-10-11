"use client";

import { Label } from "@/components/ui/label";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";

export type PeriodOption = { value: string; label: string };

type CategoryPeriodPickerProps = {
  options: PeriodOption[];
  value: PeriodOption | null;
  onChange: (value: PeriodOption | null) => void;
};

export function CategoryPeriodPicker({ options, value, onChange }: CategoryPeriodPickerProps) {
  const anchor = useComboboxAnchor();

  return (
    <div className="max-w-sm space-y-2">
      <Label>Pilih Periode</Label>
      <div ref={anchor}>
        <Combobox items={options} value={value} onValueChange={onChange}>
          <ComboboxInput placeholder="Cari periode..." />
          <ComboboxContent anchor={anchor}>
            <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
            <ComboboxList>
              {(item: PeriodOption) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>
    </div>
  );
}

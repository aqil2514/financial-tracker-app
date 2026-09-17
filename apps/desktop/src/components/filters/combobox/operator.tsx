"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function FilterOperatorCombobox({
  value,
  onChange,
}: FilterOperatorComboboxProps) {
  return (
    <Select
      value={value}
      items={COMBOBOX_OPERATOR_OPTIONS}
      onValueChange={(val) => onChange(val as SelectOperatorType)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Operator" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {COMBOBOX_OPERATOR_OPTIONS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

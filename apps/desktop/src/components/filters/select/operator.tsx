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

interface FilterOperatorSelectProps {
  value: SelectOperatorType;
  onChange: (value: SelectOperatorType) => void;
}

const SELECT_OPERATOR_OPTIONS: { value: SelectOperatorType; label: string }[] = [
  { value: "eq", label: "Adalah" },
  { value: "neq", label: "Bukan" },
  { value: "is_null", label: "Kosong" },
  { value: "is_not_null", label: "Tidak kosong" },
];

export function FilterOperatorSelect({
  value,
  onChange,
}: FilterOperatorSelectProps) {
  return (
    <Select
      value={value}
      items={SELECT_OPERATOR_OPTIONS}
      onValueChange={(val) => onChange(val as SelectOperatorType)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Operator" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {SELECT_OPERATOR_OPTIONS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function FilterOperatorText({
  value,
  onChange,
}: FilterOperatorTextProps) {
  return (
    <Select
      value={value}
      items={TEXT_OPERATOR_OPTIONS}
      onValueChange={(val) => onChange(val as TextOperatorType)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Operator" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {TEXT_OPERATOR_OPTIONS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

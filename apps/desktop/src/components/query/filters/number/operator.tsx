"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  return (
    <Select
      value={value}
      items={NUMBER_OPERATOR_OPTIONS}
      onValueChange={(val) => onChange(val as NumberOperatorType)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Operator" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {NUMBER_OPERATOR_OPTIONS.map((op) => (
            <SelectItem key={op.value} value={op.value}>
              {op.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SelectOption } from "../filter.interface";

interface FilterSelectInputProps {
  value: string[];
  options: SelectOption[];
  disabled?: boolean;
  onValueChange: (value: string[]) => void;
  onClear?: () => void;
}

export function FilterSelectInput({
  value,
  options,
  disabled,
  onValueChange,
  onClear,
}: FilterSelectInputProps) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Select
        multiple
        value={value}
        items={options}
        disabled={disabled}
        onValueChange={onValueChange}
      >
        <SelectTrigger className="min-w-0 flex-1">
          <SelectValue placeholder="Pilih nilai" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" variant="outline" size="icon" onClick={onClear}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

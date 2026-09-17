"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FilterRangeValue } from "../filter.interface";

export interface FilterNumberInputProps {
  isRange: boolean;
  value: number | null;
  rangeValue: FilterRangeValue;
  onValueChange: (value: number | null) => void;
  onRangeChange: (value: FilterRangeValue) => void;
  onEnterEvent?: () => void;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
}

function toNumberOrNull(raw: string): number | null {
  if (raw === "") return null;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

export function FilterNumberInput({
  isRange,
  value,
  rangeValue,
  onValueChange,
  onRangeChange,
  onEnterEvent,
  disabled,
  clearable,
  onClear,
}: FilterNumberInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    onEnterEvent?.();
  };

  const handleSingleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onValueChange(toNumberOrNull(e.target.value));
  };

  const handleFromChange = (e: ChangeEvent<HTMLInputElement>) => {
    onRangeChange({ ...rangeValue, from: toNumberOrNull(e.target.value) });
  };

  const handleToChange = (e: ChangeEvent<HTMLInputElement>) => {
    onRangeChange({ ...rangeValue, to: toNumberOrNull(e.target.value) });
  };

  return (
    <div className="flex items-center gap-1">
      {isRange ? (
        <div className="flex w-full items-center gap-1">
          <Input
            type="number"
            value={rangeValue.from ?? ""}
            disabled={disabled}
            className="w-full"
            placeholder="Dari"
            onChange={handleFromChange}
            onKeyDown={handleKeyDown}
          />
          <span className="text-muted-foreground text-xs">s/d</span>
          <Input
            type="number"
            value={rangeValue.to ?? ""}
            disabled={disabled}
            className="w-full"
            placeholder="Sampai"
            onChange={handleToChange}
            onKeyDown={handleKeyDown}
          />
        </div>
      ) : (
        <Input
          type="number"
          value={value ?? ""}
          disabled={disabled}
          className="w-full"
          placeholder="Masukkan nilai"
          onChange={handleSingleChange}
          onKeyDown={handleKeyDown}
        />
      )}
      {clearable && (
        <Button type="button" variant="outline" size="icon" onClick={onClear}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

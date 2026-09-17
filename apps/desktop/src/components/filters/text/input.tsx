"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FilterTextInputProps {
  value: string;
  onValueChange: (value: string) => void;
  onEnterEvent?: () => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  autoFocus?: boolean;
  maxLength?: number;
}

export function FilterTextInput({
  onEnterEvent,
  onValueChange,
  value,
  autoFocus,
  clearable,
  disabled,
  maxLength,
  onClear,
  placeholder = "Masukkan nilai",
}: FilterTextInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onValueChange(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    onEnterEvent?.();
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        className="w-full"
        placeholder={placeholder}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
      />
      {clearable && (
        <Button type="button" variant="outline" size="icon" onClick={onClear}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}

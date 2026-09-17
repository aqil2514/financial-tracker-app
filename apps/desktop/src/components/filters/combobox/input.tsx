"use client";

import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SelectOption } from "../filter.interface";

const CHIP_DISPLAY_LIMIT = 0;

interface FilterComboboxInputProps {
  value: string[];
  options: SelectOption[];
  disabled?: boolean;
  onValueChange: (value: string[]) => void;
  onClear?: () => void;
}

export function FilterComboboxInput({
  value,
  options,
  disabled,
  onValueChange,
  onClear,
}: FilterComboboxInputProps) {
  const anchor = useComboboxAnchor();
  const selectedItems = options.filter((opt) => value.includes(opt.value));
  const isOverflowing = selectedItems.length > CHIP_DISPLAY_LIMIT;

  const handleValueChange = (items: SelectOption[]) => {
    onValueChange(items.map((item) => item.value));
  };

  const handleRemoveOne = (removedValue: string) => {
    onValueChange(value.filter((v) => v !== removedValue));
  };

  return (
    <div ref={anchor} className="flex min-w-0 items-center gap-1">
      <Combobox
        multiple
        items={options}
        value={selectedItems}
        disabled={disabled}
        onValueChange={handleValueChange}
      >
        <ComboboxChips className="min-w-0 flex-1">
          {isOverflowing ? (
            <Popover>
              <PopoverTrigger
                render={
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    render={<button type="button" />}
                  />
                }
              >
                {selectedItems.length} dipilih
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <div className="flex flex-wrap gap-1">
                  {selectedItems.map((item) => (
                    <Badge key={item.value} variant="secondary" className="gap-1">
                      {item.label}
                      <button
                        type="button"
                        onClick={() => handleRemoveOne(item.value)}
                        className="rounded-full hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            selectedItems.map((item) => (
              <ComboboxChip key={item.value} aria-label={item.value}>
                {item.label}
              </ComboboxChip>
            ))
          )}
          <ComboboxChipsInput placeholder="Cari nilai..." />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>Tidak ditemukan</ComboboxEmpty>
          <ComboboxList>
            {(item: SelectOption) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <Button type="button" variant="outline" size="icon" onClick={onClear}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

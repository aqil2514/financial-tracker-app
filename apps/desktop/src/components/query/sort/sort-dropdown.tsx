"use client";

import { ArrowDownAZ, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SortConfig, SortDirection, SortKeyOption } from "./sort.interface";

interface SortDropdownProps {
  config: SortKeyOption[];
  value: SortConfig[];
  onChange: (value: SortConfig[]) => void;
}

// Dropdown sort sederhana (bukan infrastruktur sebesar filter panel):
// tiap baris pilih kolom + arah, bisa tambah baris untuk multi-sort.
export function SortDropdown({ config, value, onChange }: SortDropdownProps) {
  const usedKeys = new Set(value.map((sort) => sort.sortKey));
  const availableKeys = config.filter((option) => !usedKeys.has(option.key));

  function handleAdd() {
    if (availableKeys.length === 0) return;
    onChange([...value, { sortKey: availableKeys[0].key, sortDirection: "asc" }]);
  }

  function handleKeyChange(index: number, sortKey: string) {
    onChange(value.map((sort, i) => (i === index ? { ...sort, sortKey } : sort)));
  }

  function handleDirectionChange(index: number, sortDirection: SortDirection) {
    onChange(value.map((sort, i) => (i === index ? { ...sort, sortDirection } : sort)));
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <ArrowDownAZ className="size-4" />
            Urutkan{value.length > 0 ? ` (${value.length})` : ""}
          </Button>
        }
      />
      <PopoverContent className="w-80 space-y-2">
        {value.length === 0 && (
          <p className="text-muted-foreground text-sm">Belum ada urutan.</p>
        )}

        {value.map((sort, index) => (
          <div key={sort.sortKey} className="flex items-center gap-1.5">
            <Select
              items={config.map((opt) => ({ value: opt.key, label: opt.label }))}
              value={sort.sortKey}
              onValueChange={(sortKey) => {
                if (sortKey) handleKeyChange(index, sortKey);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.map((option) => (
                  <SelectItem
                    key={option.key}
                    value={option.key}
                    disabled={usedKeys.has(option.key) && option.key !== sort.sortKey}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ToggleGroup
              value={[sort.sortDirection]}
              onValueChange={(values: string[]) => {
                if (values.length > 0) {
                  handleDirectionChange(index, values[values.length - 1] as SortDirection);
                }
              }}
            >
              <ToggleGroupItem value="asc">Naik</ToggleGroupItem>
              <ToggleGroupItem value="desc">Turun</ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleRemove(index)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={availableKeys.length === 0}
          onClick={handleAdd}
        >
          <Plus className="size-4" />
          Tambah urutan
        </Button>
      </PopoverContent>
    </Popover>
  );
}

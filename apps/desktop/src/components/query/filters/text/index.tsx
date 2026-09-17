"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterConfig, TextOperatorType } from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterOperatorText } from "./operator";
import { FilterTextInput } from "./input";

interface FilterTextProps {
  state: FilterConfig;
  keyOptions: FilterKeyOption[];
  onChange: (state: FilterConfig) => void;
  onEnter?: () => void;
  onRemove?: () => void;
}

export function FilterText({
  state,
  keyOptions,
  onChange,
  onEnter,
  onRemove,
}: FilterTextProps) {
  const operator = state.filterOperator as TextOperatorType;
  const value = typeof state.filterValue === "string" ? state.filterValue : "";
  const isNullOperator = operator === "is_null" || operator === "is_not_null";

  const handleKeyChange = (filterKey: string | null) => {
    onChange({ ...state, filterKey: filterKey ?? "" });
  };

  const handleOperatorChange = (filterOperator: TextOperatorType) => {
    const filterValue =
      filterOperator === "is_null" || filterOperator === "is_not_null"
        ? ""
        : state.filterValue;
    onChange({ ...state, filterOperator, filterValue });
  };

  const handleValueChange = (filterValue: string) => {
    onChange({ ...state, filterValue });
  };

  return (
    <div className="grid grid-cols-[minmax(0,35fr)_minmax(0,25fr)_minmax(0,40fr)] gap-2">
      <Select
        value={state.filterKey}
        items={keyOptions.map((opt) => ({ value: opt.key, label: opt.label }))}
        onValueChange={handleKeyChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih field" />
        </SelectTrigger>
        <SelectContent>
          {keyOptions.map((opt) => (
            <SelectItem key={opt.key} value={opt.key}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FilterOperatorText value={operator} onChange={handleOperatorChange} />

      <FilterTextInput
        value={value}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onEnterEvent={onEnter}
        onClear={onRemove}
        clearable
      />
    </div>
  );
}

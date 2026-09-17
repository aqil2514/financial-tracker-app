"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FilterConfig,
  SelectOperatorType,
  SelectOption,
} from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterOperatorCombobox } from "./operator";
import { FilterComboboxInput } from "./input";

interface FilterComboboxProps {
  state: FilterConfig;
  keyOptions: FilterKeyOption[];
  options: SelectOption[];
  onChange: (state: FilterConfig) => void;
  onRemove?: () => void;
}

export function FilterCombobox({
  state,
  keyOptions,
  options,
  onChange,
  onRemove,
}: FilterComboboxProps) {
  const operator = state.filterOperator as SelectOperatorType;
  const value = Array.isArray(state.filterValue)
    ? state.filterValue.map(String)
    : [];
  const isNullOperator = operator === "is_null" || operator === "is_not_null";

  const handleKeyChange = (filterKey: string | null) => {
    onChange({ ...state, filterKey: filterKey ?? "" });
  };

  const handleOperatorChange = (filterOperator: SelectOperatorType) => {
    const filterValue =
      filterOperator === "is_null" || filterOperator === "is_not_null"
        ? []
        : state.filterValue;
    onChange({ ...state, filterOperator, filterValue });
  };

  const handleValueChange = (filterValue: string[]) => {
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

      <FilterOperatorCombobox value={operator} onChange={handleOperatorChange} />

      <FilterComboboxInput
        value={value}
        options={options}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onClear={onRemove}
      />
    </div>
  );
}

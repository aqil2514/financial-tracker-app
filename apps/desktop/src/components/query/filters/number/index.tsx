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
  FilterRangeValue,
  NumberOperatorType,
} from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterOperatorNumber } from "./operator";
import { FilterNumberInput } from "./input";

interface FilterNumberProps {
  state: FilterConfig;
  keyOptions: FilterKeyOption[];
  onChange: (state: FilterConfig) => void;
  onEnter?: () => void;
  onRemove?: () => void;
}

const EMPTY_RANGE: FilterRangeValue = { from: null, to: null };

export function FilterNumber({
  state,
  keyOptions,
  onChange,
  onEnter,
  onRemove,
}: FilterNumberProps) {
  const operator = state.filterOperator as NumberOperatorType;
  const isNullOperator = operator === "is_null" || operator === "is_not_null";
  const isRange = operator === "between" || operator === "not_between";

  const value = typeof state.filterValue === "number" ? state.filterValue : null;
  const rangeValue =
    state.filterValue && typeof state.filterValue === "object" && !Array.isArray(state.filterValue)
      ? (state.filterValue as FilterRangeValue)
      : EMPTY_RANGE;

  const handleKeyChange = (filterKey: string | null) => {
    onChange({ ...state, filterKey: filterKey ?? "" });
  };

  const handleOperatorChange = (filterOperator: NumberOperatorType) => {
    if (filterOperator === "is_null" || filterOperator === "is_not_null") {
      onChange({ ...state, filterOperator, filterValue: null });
      return;
    }
    const nowRange = filterOperator === "between" || filterOperator === "not_between";
    const filterValue = nowRange ? EMPTY_RANGE : null;
    onChange({ ...state, filterOperator, filterValue });
  };

  const handleValueChange = (filterValue: number | null) => {
    onChange({ ...state, filterValue });
  };

  const handleRangeChange = (filterValue: FilterRangeValue) => {
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

      <FilterOperatorNumber value={operator} onChange={handleOperatorChange} />

      <FilterNumberInput
        isRange={isRange}
        value={value}
        rangeValue={rangeValue}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onRangeChange={handleRangeChange}
        onEnterEvent={onEnter}
        onClear={onRemove}
        clearable
      />
    </div>
  );
}

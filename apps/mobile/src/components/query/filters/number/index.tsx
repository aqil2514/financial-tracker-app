import { View } from "react-native";
import type { FilterConfig, FilterRangeValue, NumberOperatorType } from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterKeySelector } from "../shared/key-selector";
import { FilterOperatorNumber } from "./operator";
import { FilterNumberInput } from "./input";

interface FilterNumberProps {
  state: FilterConfig;
  keyOptions: FilterKeyOption[];
  onChange: (state: FilterConfig) => void;
  onRemove?: () => void;
}

const EMPTY_RANGE: FilterRangeValue = { from: null, to: null };

export function FilterNumber({ state, keyOptions, onChange, onRemove }: FilterNumberProps) {
  const operator = state.filterOperator as NumberOperatorType;
  const isNullOperator = operator === "is_null" || operator === "is_not_null";
  const isRange = operator === "between" || operator === "not_between";

  const value = typeof state.filterValue === "number" ? state.filterValue : null;
  const rangeValue =
    state.filterValue && typeof state.filterValue === "object" && !Array.isArray(state.filterValue)
      ? (state.filterValue as FilterRangeValue)
      : EMPTY_RANGE;

  const handleKeyChange = (filterKey: string) => {
    onChange({ ...state, filterKey });
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
    <View className="gap-2">
      <View className="flex-row gap-2">
        <FilterKeySelector value={state.filterKey} keyOptions={keyOptions} onChange={handleKeyChange} />
        <FilterOperatorNumber value={operator} onChange={handleOperatorChange} />
      </View>

      <FilterNumberInput
        isRange={isRange}
        value={value}
        rangeValue={rangeValue}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onRangeChange={handleRangeChange}
        onClear={onRemove}
        clearable
      />
    </View>
  );
}

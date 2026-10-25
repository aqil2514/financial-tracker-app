import { View } from "react-native";
import type { FilterConfig, SelectOperatorType, SelectOption } from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterKeySelector } from "../shared/key-selector";
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
  const value = Array.isArray(state.filterValue) ? state.filterValue.map(String) : [];
  const isNullOperator = operator === "is_null" || operator === "is_not_null";

  const handleKeyChange = (filterKey: string) => {
    onChange({ ...state, filterKey });
  };

  const handleOperatorChange = (filterOperator: SelectOperatorType) => {
    const filterValue =
      filterOperator === "is_null" || filterOperator === "is_not_null" ? [] : state.filterValue;
    onChange({ ...state, filterOperator, filterValue });
  };

  const handleValueChange = (filterValue: string[]) => {
    onChange({ ...state, filterValue });
  };

  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <FilterKeySelector value={state.filterKey} keyOptions={keyOptions} onChange={handleKeyChange} />
        <FilterOperatorCombobox value={operator} onChange={handleOperatorChange} />
      </View>

      <FilterComboboxInput
        value={value}
        options={options}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onClear={onRemove}
      />
    </View>
  );
}

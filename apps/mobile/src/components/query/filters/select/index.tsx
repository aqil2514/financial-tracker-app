import { View } from "react-native";
import type { FilterConfig, SelectOperatorType, SelectOption } from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterKeySelector } from "../shared/key-selector";
import { FilterOperatorSelect } from "./operator";
import { FilterSelectInput } from "./input";

interface FilterSelectProps {
  state: FilterConfig;
  keyOptions: FilterKeyOption[];
  options: SelectOption[];
  onChange: (state: FilterConfig) => void;
  onRemove?: () => void;
}

export function FilterSelect({
  state,
  keyOptions,
  options,
  onChange,
  onRemove,
}: FilterSelectProps) {
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
        <FilterOperatorSelect value={operator} onChange={handleOperatorChange} />
      </View>

      <FilterSelectInput
        value={value}
        options={options}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onClear={onRemove}
      />
    </View>
  );
}

import { View } from "react-native";
import type { FilterConfig, TextOperatorType } from "../filter.interface";
import type { FilterKeyOption } from "../panel/panel.interface";
import { FilterKeySelector } from "../shared/key-selector";
import { FilterOperatorText } from "./operator";
import { FilterTextInput } from "./input";

interface FilterTextProps {
  state: FilterConfig;
  keyOptions: FilterKeyOption[];
  onChange: (state: FilterConfig) => void;
  onRemove?: () => void;
}

export function FilterText({ state, keyOptions, onChange, onRemove }: FilterTextProps) {
  const operator = state.filterOperator as TextOperatorType;
  const value = typeof state.filterValue === "string" ? state.filterValue : "";
  const isNullOperator = operator === "is_null" || operator === "is_not_null";

  const handleKeyChange = (filterKey: string) => {
    onChange({ ...state, filterKey });
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
    <View className="gap-2">
      <View className="flex-row gap-2">
        <FilterKeySelector value={state.filterKey} keyOptions={keyOptions} onChange={handleKeyChange} />
        <FilterOperatorText value={operator} onChange={handleOperatorChange} />
      </View>

      <FilterTextInput
        value={value}
        disabled={isNullOperator}
        onValueChange={handleValueChange}
        onClear={onRemove}
        clearable
      />
    </View>
  );
}

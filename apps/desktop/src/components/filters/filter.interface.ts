export interface FilterRangeValue {
  from: string | number | null;
  to: string | number | null;
}

export type FilterValueType =
  | string
  | number
  | boolean
  | null
  | string[]
  | number[]
  | FilterRangeValue;

export type TextOperatorType = "ilike" | "not_ilike" | "is_null" | "is_not_null";
export type SelectOperatorType = "eq" | "neq" | "is_null" | "is_not_null";

export type FilterOperatorType =
  | TextOperatorType
  | SelectOperatorType
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "not_between";

export interface FilterConfig {
  filterKey: string;
  filterValue: FilterValueType;
  filterOperator: FilterOperatorType;
}

// Dipakai sebagai daftar pilihan value pada filter bertipe select
export interface SelectOption {
  value: string;
  label: string;
}
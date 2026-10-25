import type { FilterOperatorType } from "../filter.interface";
import type { FilterFieldType } from "./panel.interface";

// Operator default per tipe field — dipakai saat filter baru
// ditambahkan ("Tambah Filter") maupun saat filterKey suatu filter
// diganti ke field dengan tipe berbeda (lihat panel/content.tsx).
export const DEFAULT_OPERATOR: Record<FilterFieldType, FilterOperatorType> = {
  text: "ilike",
  select: "eq",
  combobox: "eq",
  number: "eq",
  date: "eq",
};

import type { FilterConfig } from "@/components/query/filters/filter.interface";

const DATE_FILTER_KEY = "date";

// `transactions.date` adalah datetime ISO penuh — satu tanggal kalender
// (YYYY-MM-DD) harus dicocokkan sebagai rentang [00:00:00, 23:59:59],
// bukan exact match string.
export function buildDateFilter(dateKey: string): FilterConfig {
  return {
    filterKey: DATE_FILTER_KEY,
    filterOperator: "between",
    filterValue: { from: `${dateKey}T00:00:00`, to: `${dateKey}T23:59:59` },
  };
}

export function replaceDateFilter(filters: FilterConfig[], dateKey: string): FilterConfig[] {
  const withoutDate = filters.filter((f) => f.filterKey !== DATE_FILTER_KEY);
  return [...withoutDate, buildDateFilter(dateKey)];
}

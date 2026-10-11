"use client";

import { SortDropdown } from "@/components/query/sort";
import type { SortConfig, SortKeyOption } from "@/components/query/sort/sort.interface";

const SORT_CONFIG: SortKeyOption[] = [
  { key: "category_periods.name", label: "Nama Periode" },
  { key: "category_periods.start_date", label: "Tanggal Mulai" },
  { key: "category_periods.end_date", label: "Tanggal Selesai" },
];

type CategoryPeriodSortProps = {
  sorts: SortConfig[];
  onChange: (sorts: SortConfig[]) => void;
};

export function CategoryPeriodSort({ sorts, onChange }: CategoryPeriodSortProps) {
  return <SortDropdown config={SORT_CONFIG} value={sorts} onChange={onChange} />;
}

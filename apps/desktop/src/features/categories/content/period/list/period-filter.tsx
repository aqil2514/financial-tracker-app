"use client";

import { useMemo } from "react";

import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption, SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { usePeriodCategoryOptions } from "../hooks/use-period-category-options";

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "category_periods.name", label: "Nama Periode", type: "text" },
  { key: "category_id", label: "Kategori", type: "combobox" },
  { key: "status", label: "Status", type: "select" },
];

const STATIC_FILTER_SELECT_OPTIONS: SelectOptionsMap = {
  status: [
    { value: "ongoing", label: "Berlangsung" },
    { value: "done", label: "Selesai" },
  ],
};

type CategoryPeriodFilterProps = {
  filters: FilterConfig[];
  onApplyFilter: (filters: FilterConfig[]) => void;
};

export function CategoryPeriodFilter({ filters, onApplyFilter }: CategoryPeriodFilterProps) {
  const { data: categoryOptions } = usePeriodCategoryOptions();

  const selectOptions = useMemo<SelectOptionsMap>(
    () => ({
      ...STATIC_FILTER_SELECT_OPTIONS,
      category_id: (categoryOptions ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    }),
    [categoryOptions]
  );

  return (
    <FilterPanel
      config={FILTER_CONFIG}
      selectOptions={selectOptions}
      initialValue={filters}
      onApplyFilter={onApplyFilter}
    />
  );
}

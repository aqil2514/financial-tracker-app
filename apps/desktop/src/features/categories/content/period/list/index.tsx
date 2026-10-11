"use client";

import { useState } from "react";

import { QueryState } from "@/components/query-state";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { SortDropdown } from "@/components/query/sort";
import type { SortConfig, SortKeyOption } from "@/components/query/sort/sort.interface";
import { useCategoryPeriods } from "../hooks/use-category-periods";
import { CategoryPeriodFilter } from "./period-filter";
import { PeriodCard } from "./period-card";

const SORT_CONFIG: SortKeyOption[] = [
  { key: "category_periods.name", label: "Nama Periode" },
  { key: "category_periods.start_date", label: "Tanggal Mulai" },
  { key: "category_periods.end_date", label: "Tanggal Selesai" },
];

export function CategoryPeriodList() {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const { data: periods, isLoading, error } = useCategoryPeriods(filters, sorts);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryPeriodFilter filters={filters} onApplyFilter={setFilters} />
        <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />
      </div>

      <QueryState isLoading={isLoading} error={error} />

      {periods && periods.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Belum ada periode. Tambahkan lewat tombol di atas.
        </p>
      )}

      {periods && periods.length > 0 && (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((period) => (
            <PeriodCard key={period.id} period={period} />
          ))}
        </div>
      )}
    </div>
  );
}

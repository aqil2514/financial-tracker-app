"use client";

import { useMemo, useState } from "react";
import { format, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodPicker } from "@/components/query/period-picker";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { AccountType } from "@/lib/account-types";
import { BalanceTrendFilterPanel } from "./balance-trend-filter";
import { BalanceTrendChart } from "./balance-trend-chart";
import { useBalanceTrend, type BalanceTrendFilter, type Granularity } from "./use-balance-trend";

const DEFAULT_FILTERS: FilterConfig[] = [
  { filterKey: "account_type", filterOperator: "eq", filterValue: ["cash"] },
];

// `FilterPanel` generik mengembalikan FilterConfig[] (field+operator+value
// dinamis) — di-translate ke bentuk filter akun yang dipahami query. Hanya
// operator "eq" yang didukung (sesuai "Tren Keuangan — filter level akun":
// 3 filter cuma INCLUDE, tidak ada mode exclude/neq).
function toBalanceTrendFilter(filters: FilterConfig[]): BalanceTrendFilter {
  const valuesOf = (key: string): string[] => {
    const match = filters.find((f) => f.filterKey === key && f.filterOperator === "eq");
    return Array.isArray(match?.filterValue) ? match.filterValue.map(String) : [];
  };

  return {
    accountTypes: valuesOf("account_type") as AccountType[],
    groupIds: valuesOf("group_id"),
    accountIds: valuesOf("account_id"),
  };
}

export function BalanceTrendSection() {
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    return { from: format(subMonths(now, 1), "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
  });
  const [filters, setFilters] = useState<FilterConfig[]>(DEFAULT_FILTERS);
  const [granularity, setGranularity] = useState<Granularity>("day");

  const periodValue = useMemo<DateRange | undefined>(
    () => ({
      from: new Date(`${dateRange.from}T00:00`),
      to: new Date(`${dateRange.to}T00:00`),
    }),
    [dateRange]
  );

  function handlePeriodChange(range: DateRange | undefined) {
    if (!range?.from || !range.to) return;
    setDateRange({ from: format(range.from, "yyyy-MM-dd"), to: format(range.to, "yyyy-MM-dd") });
  }

  const accountFilter = useMemo(() => toBalanceTrendFilter(filters), [filters]);
  const { data, isLoading, error } = useBalanceTrend(
    dateRange.from,
    dateRange.to,
    granularity,
    accountFilter
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tren Keuangan</CardTitle>
        <PeriodPicker value={periodValue} onChange={handlePeriodChange} />
      </CardHeader>
      <CardContent className="space-y-6">
        <BalanceTrendFilterPanel
          filters={filters}
          granularity={granularity}
          onFiltersChange={setFilters}
          onGranularityChange={setGranularity}
        />
        <BalanceTrendChart
          data={data}
          isLoading={isLoading}
          error={error}
          granularity={granularity}
        />
      </CardContent>
    </Card>
  );
}

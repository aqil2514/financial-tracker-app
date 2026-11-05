import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { SegmentedControl } from "@/components/segmented-control";
import { Skeleton } from "@/components/skeleton";
import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { FilterKeyOption } from "@/components/query/filters/panel/panel.interface";
import { formatCurrency, subtractMonths, toLocalDate } from "@/lib/utils";
import { BalanceTrendChart } from "./balance-trend-chart";
import { toBalanceTrendFilter, type Granularity } from "./balance-trend-query";
import { useAccountFilterOptions } from "./use-account-filter-options";
import { useBalanceTrend } from "./use-balance-trend";

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "account_type", label: "Tipe Akun", type: "select" },
  { key: "group_id", label: "Grup Akun", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
];

// Bawaan sama dengan desktop: hanya akun bertipe Kas.
const DEFAULT_FILTERS: FilterConfig[] = [
  { filterKey: "account_type", filterOperator: "eq", filterValue: ["cash"] },
];

// Desktop memakai pemilih rentang bebas; di mobile rentangnya preset, selalu berakhir hari ini.
const PERIOD_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1 Bln" },
  { value: 3, label: "3 Bln" },
  { value: 6, label: "6 Bln" },
  { value: 12, label: "1 Thn" },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Harian" },
  { value: "week", label: "Mingguan" },
  { value: "month", label: "Bulanan" },
  { value: "year", label: "Tahunan" },
];

export function BalanceTrendSection() {
  const [periodMonths, setPeriodMonths] = useState(1);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [filters, setFilters] = useState<FilterConfig[]>(DEFAULT_FILTERS);

  const to = toLocalDate();
  const from = subtractMonths(to, periodMonths);
  const accountFilter = useMemo(() => toBalanceTrendFilter(filters), [filters]);
  const selectOptions = useAccountFilterOptions();
  const { data: points, isLoading } = useBalanceTrend(from, to, granularity, accountFilter);

  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last ? last.balance - first.balance : 0;
  const isUp = change >= 0;

  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <SegmentedControl options={PERIOD_OPTIONS} value={periodMonths} onChange={setPeriodMonths} />
        <FilterPanel
          config={FILTER_CONFIG}
          selectOptions={selectOptions}
          initialValue={filters}
          onApplyFilter={setFilters}
        />
      </View>

      <SegmentedControl options={GRANULARITY_OPTIONS} value={granularity} onChange={setGranularity} />

      {isLoading ? (
        <View className="gap-4">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-[240px] w-full" />
        </View>
      ) : points.length === 0 ? (
        <Text className="text-sm text-neutral-500">Belum ada data pada periode ini.</Text>
      ) : (
        <>
          <View className="flex-row items-center justify-between gap-2 px-1">
            <Text className="flex-1 text-sm text-neutral-500" numberOfLines={1} adjustsFontSizeToFit>
              {formatCurrency(first.balance)} → {formatCurrency(last.balance)}
            </Text>
            <Text className={`font-semibold ${isUp ? "text-emerald-600" : "text-red-600"}`}>
              {isUp ? "+" : ""}
              {formatCurrency(change)}
            </Text>
          </View>
          <BalanceTrendChart points={points} granularity={granularity} />
        </>
      )}
    </View>
  );
}

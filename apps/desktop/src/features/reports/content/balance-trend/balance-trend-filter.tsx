"use client";

import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption, SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import type { FilterConfig } from "@/components/query/filters/filter.interface";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCOUNT_TYPE_OPTIONS } from "@/lib/account-types";
import { useAccounts, useAccountGroups } from "@/hooks/resources";
import type { Granularity } from "./use-balance-trend";

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "account_type", label: "Tipe Akun", type: "select" },
  { key: "group_id", label: "Grup Akun", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
];

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "day", label: "Harian" },
  { value: "week", label: "Mingguan" },
  { value: "month", label: "Bulanan" },
  { value: "year", label: "Tahunan" },
];

export function BalanceTrendFilterPanel({
  filters,
  granularity,
  onFiltersChange,
  onGranularityChange,
}: {
  filters: FilterConfig[];
  granularity: Granularity;
  onFiltersChange: (filters: FilterConfig[]) => void;
  onGranularityChange: (value: Granularity) => void;
}) {
  const { data: accounts } = useAccounts();
  const { data: accountGroups } = useAccountGroups();

  const selectOptions: SelectOptionsMap = {
    account_type: ACCOUNT_TYPE_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
    })),
    group_id: (accountGroups ?? []).map((g) => ({ value: g.id, label: g.name })),
    account_id: (accounts ?? []).map((a) => ({
      value: a.id,
      label: a.is_active ? a.name : `${a.name} (Nonaktif)`,
    })),
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <FilterPanel
        config={FILTER_CONFIG}
        selectOptions={selectOptions}
        initialValue={filters}
        onApplyFilter={onFiltersChange}
      />

      <div className="space-y-1.5">
        <ToggleGroup
          value={[granularity]}
          onValueChange={(values: string[]) => {
            if (values.length > 0) onGranularityChange(values[values.length - 1] as Granularity);
          }}
        >
          {GRANULARITY_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}

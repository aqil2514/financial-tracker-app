"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption } from "@/components/query/filters/panel/panel.interface";
import { SortDropdown } from "@/components/query/sort";
import type { SortKeyOption } from "@/components/query/sort";
import { useAccountsList } from "../accounts-context";

// Harus sinkron dengan FILTERABLE_COLUMNS/BALANCE_FILTER_COLUMN di use-accounts-paginated.ts.
const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "name", label: "Nama Akun", type: "text" },
  { key: "group_id", label: "Grup Akun", type: "combobox" },
  { key: "initial_balance", label: "Saldo Awal", type: "number" },
  { key: "balance", label: "Saldo Berjalan", type: "number" },
];

// Harus sinkron dengan SORTABLE_COLUMNS di use-accounts-paginated.ts.
const SORT_CONFIG: SortKeyOption[] = [
  { key: "name", label: "Nama Akun" },
  { key: "group_name", label: "Nama Grup Akun" },
  { key: "initial_balance", label: "Saldo Awal" },
  { key: "created_at", label: "Tanggal Dibuat" },
  { key: "balance", label: "Saldo Berjalan" },
];

export function AccountsCardHeader() {
  const { filterSelectOptions, filters, setFilters, sorts, setSorts } =
    useAccountsList();

  return (
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle>Daftar Akun</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
        <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />
        <FilterPanel
          config={FILTER_CONFIG}
          selectOptions={filterSelectOptions}
          initialValue={filters}
          onApplyFilter={setFilters}
        />
      </div>
    </CardHeader>
  );
}

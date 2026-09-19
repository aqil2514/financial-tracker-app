"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption } from "@/components/query/filters/panel/panel.interface";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SortDropdown } from "@/components/query/sort";
import type { SortKeyOption } from "@/components/query/sort";
import { useAccountsList } from "../accounts-context";

// Harus sinkron dengan FILTERABLE_COLUMNS/BALANCE_FILTER_COLUMN di use-accounts-paginated.ts.
// is_active TIDAK dimasukkan di sini — dikontrol lewat switch "Tampilkan nonaktif"
// terpisah, lalu digabung ke FilterConfig[] di accounts-context.tsx.
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
  const {
    filterSelectOptions,
    filters,
    setFilters,
    sorts,
    setSorts,
    showInactive,
    setShowInactive,
  } = useAccountsList();

  return (
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle>Daftar Akun</CardTitle>
      <div className="flex flex-wrap items-center gap-4">
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Switch checked={showInactive} onCheckedChange={setShowInactive} />
          Tampilkan nonaktif
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />
          <FilterPanel
            config={FILTER_CONFIG}
            selectOptions={filterSelectOptions}
            initialValue={filters}
            onApplyFilter={setFilters}
          />
        </div>
      </div>
    </CardHeader>
  );
}

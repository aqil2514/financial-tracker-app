"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption } from "@/components/query/filters/panel/panel.interface";
import { SortDropdown } from "@/components/query/sort";
import type { SortKeyOption } from "@/components/query/sort";
import { useList } from "./list-context";

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
  { key: "category_id", label: "Kategori", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
  { key: "amount", label: "Jumlah", type: "number" },
];

// Harus sinkron dengan SORTABLE_COLUMNS di use-transactions.ts.
const SORT_CONFIG: SortKeyOption[] = [
  { key: "date", label: "Tanggal" },
  { key: "amount", label: "Jumlah" },
];

export function ListCardHeader() {
  const { filterSelectOptions, filters, setFilters, sorts, setSorts } = useList();

  return (
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle>Daftar Transaksi</CardTitle>
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

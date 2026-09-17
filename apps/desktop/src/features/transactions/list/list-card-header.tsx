"use client";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { FilterPanel } from "@/components/filters/panel";
import type { FilterKeyOption } from "@/components/filters/panel/panel.interface";
import { useList } from "./list-context";

const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
  { key: "category_id", label: "Kategori", type: "combobox" },
  { key: "account_id", label: "Akun", type: "combobox" },
  { key: "amount", label: "Jumlah", type: "number" },
];

// TODO: sorter sedang disusun ulang bertahap mengikuti pola panel/
// yang baru, sementara dilepas dari UI.

export function ListCardHeader() {
  const { filterSelectOptions, filters, setFilters } = useList();

  return (
    <CardHeader className="flex flex-wrap items-center justify-between gap-2">
      <CardTitle>Daftar Transaksi</CardTitle>
      <div className="flex flex-wrap items-center gap-2">
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

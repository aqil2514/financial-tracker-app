"use client";

import { FilterPanel } from "@/components/query/filters/panel";
import type { FilterKeyOption, SelectOptionsMap } from "@/components/query/filters/panel/panel.interface";
import { useDebtsSummaryPage } from "../page";

// Harus sinkron dengan FILTERABLE_COLUMNS di use-contact-summary.ts
// ("debt_kind" ditangani manual di sana, tidak lewat buildWhereClause
// generik, tapi tetap field yang sah di FilterPanel ini).
const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "contact_name", label: "Nama Kontak", type: "text" },
  { key: "debt_kind", label: "Jenis", type: "select" },
  { key: "remaining_status", label: "Status Pelunasan", type: "select" },
];

const FILTER_SELECT_OPTIONS: SelectOptionsMap = {
  debt_kind: [
    { value: "receivable", label: "Piutang" },
    { value: "payable", label: "Utang" },
  ],
  remaining_status: [
    { value: "has_remaining", label: "Belum Dibayar" },
    { value: "settled", label: "Lunas Semua" },
  ],
};

export function Filter() {
  const { filters, setFilters } = useDebtsSummaryPage();

  return (
    <FilterPanel
      config={FILTER_CONFIG}
      selectOptions={FILTER_SELECT_OPTIONS}
      initialValue={filters}
      onApplyFilter={setFilters}
    />
  );
}

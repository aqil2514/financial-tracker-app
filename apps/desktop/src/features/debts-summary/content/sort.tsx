"use client";

import { SortDropdown } from "@/components/query/sort";
import type { SortKeyOption } from "@/components/query/sort";
import { useDebtsSummaryPage } from "../page";

// Harus sinkron dengan SORTABLE_COLUMNS di use-contact-summary.ts.
const SORT_CONFIG: SortKeyOption[] = [
  { key: "contact_name", label: "Nama Kontak" },
  { key: "receivable_remaining", label: "Sisa Piutang" },
  { key: "payable_remaining", label: "Sisa Utang" },
  { key: "receivable_active", label: "Piutang Pokok" },
  { key: "payable_active", label: "Utang Pokok" },
];

export function Sort() {
  const { sorts, setSorts } = useDebtsSummaryPage();

  return <SortDropdown config={SORT_CONFIG} value={sorts} onChange={setSorts} />;
}

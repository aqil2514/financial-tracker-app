"use client";

import { createContext, useContext, useState } from "react";

import type { FilterConfig } from "@/components/query/filters/filter.interface";
import type { SortConfig } from "@/components/query/sort/sort.interface";
import { useContactSummary, type ContactDebtSummary } from "@/shared/debts/use-contact-summary";
import { useDebtsList, type DebtListRow } from "@/shared/debts/use-debts-list";

interface DebtsSummaryPageContextType {
  summary: ContactDebtSummary[] | undefined;
  isLoading: boolean;
  receivables: DebtListRow[] | undefined;
  payables: DebtListRow[] | undefined;
  filters: FilterConfig[];
  setFilters: (filters: FilterConfig[]) => void;
  sorts: SortConfig[];
  setSorts: (sorts: SortConfig[]) => void;
}

const DebtsSummaryPageContext = createContext<DebtsSummaryPageContextType | undefined>(undefined);

/** Data halaman `/debts` — dipasang di `app/(app)/debts/page.tsx` (lihat
 * pola `TransactionsPageProvider` di
 * features/transactions/page/transactions-page-context.tsx). Consumer
 * saat ini `content/card-grid.tsx`, `content/filter.tsx`,
 * `content/sort.tsx` — Provider ditempatkan di level page (bukan di
 * dalam salah satu consumer) supaya kontrak "data milik halaman ini"
 * konsisten dengan pola project — section/sibling baru di halaman ini
 * nanti tinggal panggil `useDebtsSummaryPage()`, tidak perlu fetch ulang.
 *
 * `filters`/`sorts` (Nama/Jenis/Status pelunasan, lihat
 * content/filter.tsx & content/sort.tsx) HANYA memengaruhi `summary` —
 * `receivables`/`payables` (dipakai `content/card-grid.tsx` untuk
 * findOldestOngoing) sengaja TIDAK ikut difilter/diurutkan oleh state
 * ini. */
export function DebtsSummaryPageProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<FilterConfig[]>([]);
  const [sorts, setSorts] = useState<SortConfig[]>([]);
  const { data: summary, isLoading } = useContactSummary(filters, sorts);
  const { data: receivables } = useDebtsList("receivable");
  const { data: payables } = useDebtsList("payable");

  return (
    <DebtsSummaryPageContext.Provider
      value={{ summary, isLoading, receivables, payables, filters, setFilters, sorts, setSorts }}
    >
      {children}
    </DebtsSummaryPageContext.Provider>
  );
}

export function useDebtsSummaryPage() {
  const context = useContext(DebtsSummaryPageContext);
  if (!context) {
    throw new Error("useDebtsSummaryPage must be used within DebtsSummaryPageProvider");
  }
  return context;
}

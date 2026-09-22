"use client";

import { createContext, useContext } from "react";

import { useContactSummary, type ContactDebtSummary } from "@/shared/debts/use-contact-summary";
import { useDebtsList, type DebtListRow } from "@/shared/debts/use-debts-list";

interface DebtsPageContextType {
  summary: ContactDebtSummary[] | undefined;
  isLoading: boolean;
  receivables: DebtListRow[] | undefined;
  payables: DebtListRow[] | undefined;
}

const DebtsPageContext = createContext<DebtsPageContextType | undefined>(undefined);

/** Data halaman `/debts` — dipasang di `app/(app)/debts/page.tsx` (lihat
 * pola `TransactionsPageProvider` di
 * features/transactions/page/transactions-page-context.tsx). Consumer
 * sesungguhnya saat ini baru `ContactSummaryCard`, tapi Provider
 * ditempatkan di level page (bukan di dalam `ContactSummaryCard`
 * sendiri) supaya kontrak "data milik halaman ini" konsisten dengan
 * pola project — section/sibling baru di halaman ini nanti tinggal
 * panggil `useDebtsPage()`, tidak perlu fetch ulang. */
export function DebtsPageProvider({ children }: { children: React.ReactNode }) {
  const { data: summary, isLoading } = useContactSummary();
  const { data: receivables } = useDebtsList("receivable");
  const { data: payables } = useDebtsList("payable");

  return (
    <DebtsPageContext.Provider value={{ summary, isLoading, receivables, payables }}>
      {children}
    </DebtsPageContext.Provider>
  );
}

export function useDebtsPage() {
  const context = useContext(DebtsPageContext);
  if (!context) {
    throw new Error("useDebtsPage must be used within DebtsPageProvider");
  }
  return context;
}

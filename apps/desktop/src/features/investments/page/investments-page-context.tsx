"use client";

import { createContext, useContext } from "react";
import { parseAsStringEnum, useQueryState } from "nuqs";

export type InvestmentsTab = "ringkasan" | "detail";
const INVESTMENTS_TABS = ["ringkasan", "detail"] as const;

type InvestmentsPageContextType = {
  activeTab: InvestmentsTab;
  setActiveTab: (value: InvestmentsTab) => void;
};

const InvestmentsPageContext = createContext<InvestmentsPageContextType | undefined>(undefined);

/** Tab aktif (Ringkasan/Detail) tersimpan di URL (nuqs) — pola sama
 * AccountsProvider (features/accounts/sections/list/context), supaya
 * tidak hilang saat refresh. */
export function InvestmentsPageProvider({ children }: { children: React.ReactNode }) {
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum<InvestmentsTab>([...INVESTMENTS_TABS]).withDefault("ringkasan")
  );

  return (
    <InvestmentsPageContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </InvestmentsPageContext.Provider>
  );
}

export function useInvestmentsPage() {
  const context = useContext(InvestmentsPageContext);
  if (!context) {
    throw new Error("useInvestmentsPage must be used within InvestmentsPageProvider");
  }
  return context;
}

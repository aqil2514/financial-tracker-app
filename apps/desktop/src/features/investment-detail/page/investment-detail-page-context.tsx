"use client";

import { createContext, useContext } from "react";

import { useAccounts, type AccountWithBalance } from "@/features/accounts";

type InvestmentDetailPageContextType = {
  accountId: string;
  account: AccountWithBalance | undefined;
  isLoading: boolean;
};

const InvestmentDetailPageContext = createContext<InvestmentDetailPageContextType | undefined>(
  undefined
);

/** Resolve `accountId` (dari query param `?id=`) ke data akun lengkap —
 * pola PERSIS `AccountDetailPageProvider` (features/account-detail/page/). */
export function InvestmentDetailPageProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const { data: accounts, isLoading } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);

  return (
    <InvestmentDetailPageContext.Provider value={{ accountId, account, isLoading }}>
      {children}
    </InvestmentDetailPageContext.Provider>
  );
}

export function useInvestmentDetailPage() {
  const context = useContext(InvestmentDetailPageContext);
  if (!context) {
    throw new Error("useInvestmentDetailPage must be used within InvestmentDetailPageProvider");
  }
  return context;
}

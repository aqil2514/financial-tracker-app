"use client";

import { createContext, useContext } from "react";

import { useAccounts, type AccountWithBalance } from "@/features/accounts";

type ForexDetailPageContextType = {
  accountId: string;
  account: AccountWithBalance | undefined;
  isLoading: boolean;
};

const ForexDetailPageContext = createContext<ForexDetailPageContextType | undefined>(undefined);

export function ForexDetailPageProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: React.ReactNode;
}) {
  const { data: accounts, isLoading } = useAccounts();
  const account = accounts?.find((a) => a.id === accountId);

  return (
    <ForexDetailPageContext.Provider value={{ accountId, account, isLoading }}>
      {children}
    </ForexDetailPageContext.Provider>
  );
}

export function useForexDetailPage() {
  const context = useContext(ForexDetailPageContext);
  if (!context) {
    throw new Error("useForexDetailPage must be used within ForexDetailPageProvider");
  }
  return context;
}

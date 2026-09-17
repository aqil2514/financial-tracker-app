"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { format } from "date-fns";

interface TransactionsPageContextType {
  selectedDate: Date | undefined;
  setSelectedDate: (date: Date | undefined) => void;
  dateFilter: string | undefined;
}

const TransactionsPageContext = createContext<TransactionsPageContextType | undefined>(
  undefined
);

export function TransactionsPageProvider({ children }: { children: React.ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();

  const dateFilter = useMemo(
    () => (selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined),
    [selectedDate]
  );

  return (
    <TransactionsPageContext.Provider value={{ selectedDate, setSelectedDate, dateFilter }}>
      {children}
    </TransactionsPageContext.Provider>
  );
}

export function useTransactionsPage() {
  const context = useContext(TransactionsPageContext);
  if (!context) {
    throw new Error("useTransactionsPage must be used within TransactionsPageProvider");
  }
  return context;
}

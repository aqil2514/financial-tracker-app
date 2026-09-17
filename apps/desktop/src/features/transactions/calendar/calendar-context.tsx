"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { format } from "date-fns";

import { useTransactionsPage } from "../page/transactions-page-context";
import { useTransactionDays, type DaySummary } from "./use-transaction-days";
import { useMonthSummary, type MonthSummary } from "./use-month-summary";

interface CalendarContextType {
  selectedDate: Date | undefined;
  onSelectedDateChange: (date: Date | undefined) => void;
  month: Date;
  setMonth: (date: Date) => void;
  transactionDays: Map<string, DaySummary> | undefined;
  monthSummary: MonthSummary | undefined;
  net: number;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const { selectedDate, setSelectedDate: onSelectedDateChange } = useTransactionsPage();
  const [month, setMonth] = useState(new Date());
  const monthKey = format(month, "yyyy-MM");

  const { data: transactionDays } = useTransactionDays(monthKey);
  const { data: monthSummary } = useMonthSummary(monthKey);

  const net = useMemo(
    () => (monthSummary?.income ?? 0) - (monthSummary?.expense ?? 0),
    [monthSummary]
  );

  return (
    <CalendarContext.Provider
      value={{
        selectedDate,
        onSelectedDateChange,
        month,
        setMonth,
        transactionDays,
        monthSummary,
        net,
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
}

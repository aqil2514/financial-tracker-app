import React, { createContext, useContext, useState } from "react";

export interface CashflowDateRange {
  dateFrom: string;
  dateTo: string;
  timezone: string;
}

interface RetailkuSyncCashflowSummaryContextType {
  range: CashflowDateRange;
  setRange: React.Dispatch<React.SetStateAction<CashflowDateRange>>;
}

const RetailkuSyncCashflowSummaryContext =
  createContext<RetailkuSyncCashflowSummaryContextType>(
    {} as RetailkuSyncCashflowSummaryContextType,
  );

interface Props {
  children: React.ReactNode;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export function RetailkuSyncCashflowSummaryProvider({ children }: Props) {
  const [range, setRange] = useState<CashflowDateRange>({
    dateFrom: daysAgoIso(7),
    dateTo: todayIso(),
    timezone: "Asia/Jakarta",
  });

  console.log(range);

  const values: RetailkuSyncCashflowSummaryContextType = {
    range,
    setRange,
  };

  return (
    <RetailkuSyncCashflowSummaryContext.Provider value={values}>
      {children}
    </RetailkuSyncCashflowSummaryContext.Provider>
  );
}

export const useRetailkuSyncCashflowSummary = () =>
  useContext(RetailkuSyncCashflowSummaryContext);

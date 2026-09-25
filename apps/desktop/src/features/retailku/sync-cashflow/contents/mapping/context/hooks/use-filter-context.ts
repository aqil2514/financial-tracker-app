import { RetailkuCashflowSyncMode } from "@/features/retailku/sync-cashflow/sync";
import { useState } from "react";
import { UseFilterContextOutput } from "../interfaces";

export function useFilterContext(): UseFilterContextOutput {
  const [mode, setMode] = useState<RetailkuCashflowSyncMode>("summary");
  const [dateFrom, setDateFrom] = useState(todayIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [activeKey, setActiveKey] = useState<string | undefined>(undefined);

  return {
    mode,
    setMode,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    activeKey,
    setActiveKey,
  };
}

const todayIso = () => {
  return new Date().toISOString().slice(0, 10);
};

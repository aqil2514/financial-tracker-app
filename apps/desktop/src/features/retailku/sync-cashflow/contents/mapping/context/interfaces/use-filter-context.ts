import { Dispatch, SetStateAction } from "react";
import { RetailkuCashflowSyncMode } from ".";

// apps\desktop\src\features\retailku\sync-cashflow\contents\mapping\context\hooks\use-filter-context.ts

export interface UseFilterContextOutput {
  mode: RetailkuCashflowSyncMode;
  setMode: Dispatch<SetStateAction<RetailkuCashflowSyncMode>>;
  dateFrom: string;
  setDateFrom: Dispatch<SetStateAction<string>>;
  dateTo: string;
  setDateTo: Dispatch<SetStateAction<string>>;
  activeKey: string | undefined;
  setActiveKey: Dispatch<SetStateAction<string | undefined>>;
}

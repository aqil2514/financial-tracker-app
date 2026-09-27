import type { RetailkuSettings } from "@/shared/retailku";
import type { RetailkuCashflowSyncMode } from "../../../../shared/sync";
import type { SyncRange } from "./use-sync-from-draft";

export interface UseSyncNowInput {
  hasCredentials: boolean;
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  arApCashAccountId: string;
  receivableDebtAccountId: string;
  payableDebtAccountId: string;
  syncRangeValue: SyncRange;
}

export interface UseSyncNowOutput {
  canSync: boolean;
  handleSyncNow(): void;
  isSyncing: boolean;
}

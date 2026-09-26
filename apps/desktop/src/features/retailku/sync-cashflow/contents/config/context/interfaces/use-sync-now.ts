import type { RetailkuSettings } from "@/shared/retailku";
import type { RetailkuCashflowSyncMode } from "../../../../sync";

export interface UseSyncNowInput {
  hasCredentials: boolean;
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  arApCashAccountId: string;
  receivableDebtAccountId: string;
  payableDebtAccountId: string;
  syncFromValue: string;
  onSynced: (today: string) => void;
}

export interface UseSyncNowOutput {
  canSync: boolean;
  handleSyncNow(): void;
  isSyncing: boolean;
}

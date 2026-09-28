import type { UseMutationResult } from "@tanstack/react-query";
import type { RetailkuSettings } from "@/shared/retailku";
import type { CashflowSyncPlan, RetailkuArApExistingMode, RetailkuCashflowSyncMode } from "../../../shared/sync";
import type { SyncRange } from "./use-sync-from-draft";

export interface UsePreviewSyncInput {
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  arApExistingMode: RetailkuArApExistingMode;
  syncRangeValue: SyncRange;
}

export interface PreviewSyncResult {
  cashflow: CashflowSyncPlan;
}

export type UsePreviewSyncOutput = UseMutationResult<PreviewSyncResult, Error, UsePreviewSyncInput>;

import type { UseMutationResult } from "@tanstack/react-query";
import type { RetailkuSettings } from "@/shared/retailku";
import type { CashflowSyncPlan, RetailkuCashflowSyncMode } from "../../../../shared/sync";

export interface UsePreviewSyncInput {
  retailkuSettings: RetailkuSettings | undefined;
  mode: RetailkuCashflowSyncMode;
  syncFromValue: string;
  arApCashAccountId: number | null;
  receivableDebtAccountId: number | null;
  payableDebtAccountId: number | null;
}

export interface PreviewSyncResult {
  cashflow: CashflowSyncPlan;
}

export type UsePreviewSyncOutput = UseMutationResult<PreviewSyncResult, Error, UsePreviewSyncInput>;

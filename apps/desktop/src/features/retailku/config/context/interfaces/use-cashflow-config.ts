import type { UseSyncPrerequisitesOutput } from "./use-sync-prerequisites";
import type { UseCashflowSyncFieldsOutput } from "./use-cashflow-sync-fields";
import type { UseSyncFromDraftOutput } from "./use-sync-from-draft";
import type { UseSyncNowOutput } from "./use-sync-now";
import type { UsePreviewSyncOutput } from "./use-preview-sync";

export interface UseCashflowConfigOutput {
  prerequisites: UseSyncPrerequisitesOutput;
  fields: UseCashflowSyncFieldsOutput;
  syncFrom: UseSyncFromDraftOutput;
  syncNow: UseSyncNowOutput;
  preview: UsePreviewSyncOutput;
}

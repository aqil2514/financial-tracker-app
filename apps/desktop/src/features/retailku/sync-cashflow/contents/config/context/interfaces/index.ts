import { UseSyncPrerequisitesOutput } from "./use-sync-prerequisites";
import { SetSyncSettings, UseSettingsDraftOutput } from "./use-settings-draft";
import { UseCashflowSyncFieldsOutput } from "./use-cashflow-sync-fields";
import { UseDebtAccountsDraftOutput } from "./use-debt-accounts-draft";
import { UseSyncFromDraftOutput } from "./use-sync-from-draft";
import { UseSyncNowInput, UseSyncNowOutput } from "./use-sync-now";
import {
  PreviewSyncResult,
  UsePreviewSyncInput,
  UsePreviewSyncOutput,
} from "./use-preview-sync";
import { UseCashflowConfigOutput } from "./use-cashflow-config";

export type {
  //   Prerequisites
  UseSyncPrerequisitesOutput,

  //   Settings draft
  SetSyncSettings,
  UseSettingsDraftOutput,

  //   Sync fields
  UseCashflowSyncFieldsOutput,

  //   Debt accounts
  UseDebtAccountsDraftOutput,

  //   Sync from
  UseSyncFromDraftOutput,

  //   Sync now
  UseSyncNowInput,
  UseSyncNowOutput,

  //   Preview sync
  PreviewSyncResult,
  UsePreviewSyncInput,
  UsePreviewSyncOutput,

  //   Cashflow config (orkestrator)
  UseCashflowConfigOutput,
};

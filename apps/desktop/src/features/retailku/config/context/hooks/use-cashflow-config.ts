"use client";

import { useSyncPrerequisites } from "./use-sync-prerequisites";
import { useCashflowSyncFields } from "./use-cashflow-sync-fields";
import { useSyncFromDraft } from "./use-sync-from-draft";
import { useSyncNow } from "./use-sync-now";
import { usePreviewSync } from "./use-preview-sync";
import { UseCashflowConfigOutput } from "../interfaces";

export function useCashflowConfig(): UseCashflowConfigOutput {
  const prerequisites = useSyncPrerequisites();
  const fields = useCashflowSyncFields();
  const syncFrom = useSyncFromDraft();
  const syncNow = useSyncNow({
    hasCredentials: prerequisites.hasCredentials,
    retailkuSettings: prerequisites.retailkuSettings,
    mode: fields.mode.value,
    arApExistingMode: fields.arApExistingMode.value,
    syncRangeValue: syncFrom.range,
  });

  const preview = usePreviewSync();

  return { prerequisites, fields, syncFrom, syncNow, preview };
}

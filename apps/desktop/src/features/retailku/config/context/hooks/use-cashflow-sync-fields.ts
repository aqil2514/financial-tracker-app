"use client";

import { useRetailkuCashflowSyncSettings, useSetRetailkuCashflowSyncSettings } from "../../../shared/sync";
import { useSettingsDraft } from "./use-settings-draft";
import { UseCashflowSyncFieldsOutput } from "../interfaces";

export function useCashflowSyncFields(): UseCashflowSyncFieldsOutput {
  const { data: syncSettings, isLoading: syncSettingsLoading } = useRetailkuCashflowSyncSettings();
  const setSyncSettings = useSetRetailkuCashflowSyncSettings();

  const modeDraft = useSettingsDraft("syncMode", syncSettings?.syncMode ?? "summary", setSyncSettings);
  const arApExistingModeDraft = useSettingsDraft(
    "arApExistingMode",
    syncSettings?.arApExistingMode ?? "skip",
    setSyncSettings
  );

  return {
    syncSettings,
    syncSettingsLoading,
    setSyncSettings,
    mode: modeDraft,
    arApExistingMode: arApExistingModeDraft,
  };
}

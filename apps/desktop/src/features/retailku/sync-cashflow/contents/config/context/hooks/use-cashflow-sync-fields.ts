"use client";

import { useRetailkuCashflowSyncSettings, useSetRetailkuCashflowSyncSettings } from "../../../../shared/sync";
import { useSettingsDraft } from "./use-settings-draft";
import { UseCashflowSyncFieldsOutput } from "../interfaces";

/**
 * Field-field pengaturan sync — SEMUA pakai pola draft+tombol "Simpan"
 * per section (lewat `useSettingsDraft`), BUKAN auto-mutate saat
 * dipilih dan BUKAN `useState` lokal murni (murni `useState` sempat
 * bikin field hilang begitu pindah tab/tutup app). Field disimpan ke
 * `settings` lewat `useRetailkuCashflowSyncSettings`.
 */
export function useCashflowSyncFields(): UseCashflowSyncFieldsOutput {
  const { data: syncSettings, isLoading: syncSettingsLoading } = useRetailkuCashflowSyncSettings();
  const setSyncSettings = useSetRetailkuCashflowSyncSettings();

  const modeDraft = useSettingsDraft("syncMode", syncSettings?.syncMode ?? "summary", setSyncSettings);
  const arApCashAccountIdDraft = useSettingsDraft(
    "arApCashAccountId",
    syncSettings?.arApCashAccountId ?? null,
    setSyncSettings
  );
  const autoSyncEnabledDraft = useSettingsDraft(
    "autoSyncEnabled",
    syncSettings?.autoSyncEnabled ?? true,
    setSyncSettings
  );

  return {
    syncSettings,
    syncSettingsLoading,
    setSyncSettings,
    mode: modeDraft,
    arApCashAccountId: arApCashAccountIdDraft,
    autoSyncEnabled: autoSyncEnabledDraft,
    lastAutoSyncDate: syncSettings?.lastAutoSyncDate ?? null,
  };
}

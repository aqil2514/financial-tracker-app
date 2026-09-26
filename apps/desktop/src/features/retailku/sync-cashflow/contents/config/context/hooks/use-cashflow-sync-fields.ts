"use client";

import { useRetailkuCashflowSyncSettings, useSetRetailkuCashflowSyncSettings } from "../../../../shared/sync";
import { useSettingsDraft } from "./use-settings-draft";
import { UseCashflowSyncFieldsOutput } from "../interfaces";

/**
 * Field-field pengaturan sync — SEMUA pakai pola draft+tombol "Simpan"
 * per section (lewat `useSettingsDraft`), BUKAN auto-mutate saat
 * dipilih dan BUKAN `useState` lokal murni. Field disimpan ke
 * `settings` lewat `useRetailkuCashflowSyncSettings`.
 *
 * Riwayat: sempat auto-mutate langsung tanpa tombol Simpan sama sekali
 * (tiap `onValueChange` langsung `setSyncSettings.mutate(...)`), lalu
 * SEBELUM itu malah cuma `useState` lokal murni (ditemukan bug live —
 * hilang begitu pindah tab/tutup app, lihat catatan bug di
 * use-cashflow-config.ts). Draft+tombol per section adalah desain
 * final: field TETAP tersambung ke `settings` (tidak mengulang bug
 * lama), tapi user eksplisit menekan "Simpan" per section (tiap
 * section fokus berbeda), bukan auto-save sunyi per klik.
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

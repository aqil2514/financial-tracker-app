"use client";

import { useState } from "react";

import type { RetailkuCashflowSyncSettings } from "@/shared/retailku";

type SetSyncSettings = {
  mutate: (
    settings: Partial<RetailkuCashflowSyncSettings>,
    options?: { onSuccess?: () => void }
  ) => void;
  isPending: boolean;
};

/**
 * Generalisasi pola draft+tombol "Simpan" per section — dipakai tiap
 * section yang PUNYA tombol Simpan sendiri (mode, akun kas AR/AP,
 * auto-sync), beda dari pola lama "langsung ter-mutate saat dipilih".
 * `key` adalah nama field di `RetailkuCashflowSyncSettings` yang mau
 * di-draft; `savedValue` nilai tersimpan saat ini untuk field itu.
 */
export function useSettingsDraft<K extends keyof RetailkuCashflowSyncSettings>(
  key: K,
  savedValue: RetailkuCashflowSyncSettings[K],
  setSyncSettings: SetSyncSettings
) {
  const [draft, setDraft] = useState<RetailkuCashflowSyncSettings[K] | null>(null);

  const value = draft ?? savedValue;
  const isDirty = draft != null && draft !== savedValue;

  function handleSave() {
    if (draft == null) return;
    setSyncSettings.mutate({ [key]: draft } as Partial<RetailkuCashflowSyncSettings>, {
      onSuccess: () => setDraft(null),
    });
  }

  return {
    value,
    draft,
    setDraft,
    isDirty,
    handleSave,
    isSaving: setSyncSettings.isPending,
  };
}

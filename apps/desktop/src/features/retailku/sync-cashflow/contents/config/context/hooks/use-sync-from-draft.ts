"use client";

import { useState } from "react";

import type { SetSyncSettings, UseSyncFromDraftOutput } from "../interfaces";

/**
 * Draft "Titik Awal Sync" — SATU-SATUNYA field di tab Konfigurasi yang
 * pakai pola draft+tombol "Simpan" eksplisit (`useState` lokal), beda
 * dari field lain di use-cashflow-sync-fields.ts yang langsung
 * ter-mutate saat dipilih. Menerima `syncSettings`/`setSyncSettings`
 * dari caller (bukan query sendiri) supaya tidak ada 2 sumber data
 * untuk `settings` yang sama.
 */
export function useSyncFromDraft(
  savedSyncFrom: string | null,
  setSyncSettings: SetSyncSettings
): UseSyncFromDraftOutput {
  const [syncFromDraft, setSyncFromDraft] = useState<string | null>(null);

  const syncFromValue = syncFromDraft ?? savedSyncFrom ?? "";

  function handleSaveSyncFrom() {
    if (syncFromDraft == null) return;
    setSyncSettings.mutate({ syncFrom: syncFromDraft }, { onSuccess: () => setSyncFromDraft(null) });
  }

  function advanceSyncFromToToday(today: string) {
    setSyncSettings.mutate({ syncFrom: today });
  }

  return {
    syncFromValue,
    savedSyncFrom,
    syncFromDraft,
    setSyncFromDraft,
    handleSaveSyncFrom,
    advanceSyncFromToToday,
    isSaving: setSyncSettings.isPending,
  };
}

"use client";

import { useSyncPrerequisites } from "./use-sync-prerequisites";
import { useCashflowSyncFields } from "./use-cashflow-sync-fields";
import { useDebtAccountsDraft } from "./use-debt-accounts-draft";
import { useSyncFromDraft } from "./use-sync-from-draft";
import { useSyncNow } from "./use-sync-now";

/**
 * Orkestrator state + logic untuk tab "Konfigurasi", lihat
 * docs/todos/plan/retailku-cashflow-sync.md keputusan #1/#2 (REVISI)/#3.
 * Trigger otomatis saat app dibuka BELUM diwire di sini — itu titik
 * masuk terpisah (mis. AppSidebar), hook ini baru menyediakan
 * pengaturannya.
 *
 * Digabung dari 5 hook fokus terpisah di folder ini, dikembalikan
 * APA ADANYA per-namespace (bukan di-flatten) supaya return type di
 * sini tetap pendek — caller men-destructure tiap namespace sendiri:
 * - `prerequisites` (`useSyncPrerequisites`) — mapping akun, kredensial,
 *   opsi akun lokal
 * - `fields` (`useCashflowSyncFields`) — mode, akun kas AR/AP,
 *   auto-sync — MASING-MASING draft+tombol Simpan sendiri (via
 *   `useSettingsDraft`), bukan auto-mutate maupun `useState` lokal
 *   murni. Riwayat lengkap di use-cashflow-sync-fields.ts.
 * - `debtAccounts` (`useDebtAccountsDraft`) — 2 field akun debt
 *   (piutang & utang), draft GABUNGAN dengan SATU tombol Simpan untuk
 *   keduanya (beda dari `fields` yang satu tombol per field)
 * - `syncFrom` (`useSyncFromDraft`) — draft "Titik Awal Sync"
 * - `syncNow` (`useSyncNow`) — orkestrasi aksi "Sync Sekarang", pakai
 *   NILAI EFEKTIF (draft ?? saved) dari semua field di atas
 *
 * CATATAN keputusan #2 revisi: TIDAK ADA LAGI validasi "semua mapping
 * harus ke akun lokal yang sama" — cashflow sekarang sync per akun kas
 * Retailku sendiri-sendiri (lihat sync-cashflow.ts), jadi mapping akun
 * cuma perlu ADA (bukan seragam) supaya tidak ada baris di-skip sebagai
 * "belum dipetakan".
 */
export function useCashflowConfig() {
  const prerequisites = useSyncPrerequisites();
  const fields = useCashflowSyncFields();
  const debtAccounts = useDebtAccountsDraft(
    fields.syncSettings?.receivableDebtAccountId ?? null,
    fields.syncSettings?.payableDebtAccountId ?? null,
    fields.setSyncSettings
  );
  const syncFrom = useSyncFromDraft(fields.syncSettings?.syncFrom ?? null, fields.setSyncSettings);
  const syncNow = useSyncNow({
    hasMappings: prerequisites.hasMappings,
    hasCredentials: prerequisites.hasCredentials,
    retailkuSettings: prerequisites.retailkuSettings,
    mode: fields.mode.value,
    arApCashAccountId: fields.arApCashAccountId.value?.toString() ?? "",
    receivableDebtAccountId: debtAccounts.receivableDebtAccountId?.toString() ?? "",
    payableDebtAccountId: debtAccounts.payableDebtAccountId?.toString() ?? "",
    syncFromValue: syncFrom.syncFromValue,
    onSynced: syncFrom.advanceSyncFromToToday,
  });

  return { prerequisites, fields, debtAccounts, syncFrom, syncNow };
}

"use client";

import { useSyncPrerequisites } from "./use-sync-prerequisites";
import { useCashflowSyncFields } from "./use-cashflow-sync-fields";
import { useDebtAccountsDraft } from "./use-debt-accounts-draft";
import { useSyncFromDraft } from "./use-sync-from-draft";
import { useSyncNow } from "./use-sync-now";
import { usePreviewSync } from "./use-preview-sync";
import { UseCashflowConfigOutput } from "../interfaces";

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
 * - `prerequisites` (`useSyncPrerequisites`) — kredensial, opsi akun
 *   lokal (mapping akun dipindah ke tab "Mapping", TIDAK lagi jadi
 *   syarat di sini — lihat catatan di bawah)
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
 * - `preview` (`usePreviewSync`) — hitung APA yang akan disinkronkan
 *   TANPA insert, dipakai dialog preview di contents/preview-sync-section.tsx
 *

 * CATATAN keputusan #2 revisi: TIDAK ADA LAGI validasi "semua mapping
 * harus ke akun lokal yang sama" — cashflow sekarang sync per akun kas
 * Retailku sendiri-sendiri (lihat sync-cashflow.ts).
 *
 * CATATAN (2026-09-24): `hasMappings` SUDAH DIHAPUS sebagai syarat
 * `canSync`/`canPreview` — mewajibkan mapping ADA sebagai gate
 * KESELURUHAN tombol tidak lagi masuk akal begitu key mapping jadi
 * granular per mode+sourceType+arah (bisa ADA sebagian, belum sebagian
 * lain, lihat docs/todos/plan/retailku-sync-field-mapping.md); sync per
 * baris SUDAH skip sendiri key yang belum dipetakan (toast peringatan
 * "Lengkapi di tab Mapping", lihat use-sync-now.ts) — gate keras di sini
 * cuma memblokir baris LAIN yang justru sudah valid. Section "Mapping
 * Akun" (`mapping-status-section.tsx`) yang menampilkan status ini juga
 * SUDAH DIHAPUS dari tab Konfigurasi karena alasan sama.
 */
export function useCashflowConfig(): UseCashflowConfigOutput {
  const prerequisites = useSyncPrerequisites();
  const fields = useCashflowSyncFields();
  const debtAccounts = useDebtAccountsDraft(
    fields.syncSettings?.receivableDebtAccountId ?? null,
    fields.syncSettings?.payableDebtAccountId ?? null,
    fields.setSyncSettings
  );
  const syncFrom = useSyncFromDraft(fields.syncSettings?.syncFrom ?? null, fields.setSyncSettings);
  const syncNow = useSyncNow({
    hasCredentials: prerequisites.hasCredentials,
    retailkuSettings: prerequisites.retailkuSettings,
    mode: fields.mode.value,
    arApCashAccountId: fields.arApCashAccountId.value?.toString() ?? "",
    receivableDebtAccountId: debtAccounts.receivableDebtAccountId?.toString() ?? "",
    payableDebtAccountId: debtAccounts.payableDebtAccountId?.toString() ?? "",
    syncFromValue: syncFrom.syncFromValue,
    onSynced: syncFrom.advanceSyncFromToToday,
  });

  const preview = usePreviewSync();

  return { prerequisites, fields, debtAccounts, syncFrom, syncNow, preview };
}

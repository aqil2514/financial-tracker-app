"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { QUERY_DEPENDENCIES } from "@/lib/query-dependencies";
import { assertRetailkuConfigured, useRetailkuAccountMapping, useRetailkuSettings } from "@/shared/retailku";
import { syncAll } from "./sync-all";
import {
  useRetailkuCashflowSyncSettings,
  useSetRetailkuCashflowSyncSettings,
  retailkuCashflowSyncSettingsQueryKey,
} from "./use-retailku-cashflow-sync-settings";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Trigger sync OTOMATIS saat app dibuka — lihat "Pertanyaan terbuka #2"
 * di retailku-cashflow-sync.md. Dipasang di `AppSidebar` (pola sama
 * seperti `useRetailkuPaymentAccounts()`/`useRetailkuMappingIssues()`
 * di situ — best-effort, tidak memblokir render apa pun).
 *
 * TIGA pagar sebelum benar-benar jalan (beda dari prefetch yang cuma
 * baca — ini MENULIS transaksi baru):
 * 1. Toggle `autoSyncEnabled` (default menyala) harus nyala.
 * 2. Maksimal 1x per hari — skip kalau `lastAutoSyncDate` sudah hari
 *    ini.
 * 3. Semua field konfigurasi WAJIB sudah terisi (mapping, kredensial,
 *    3 akun, titik awal) — TIDAK ada UI di sini untuk mengisinya, jadi
 *    auto-sync diam-diam skip (bukan toast error) kalau belum lengkap;
 *    itu tanggung jawab tab Konfigurasi, bukan trigger otomatis ini.
 *
 * Pakai `useMutation` polos (bukan `useDbMutation`) supaya toast
 * kegagalan bisa berupa WARNING non-blocking (bukan toast error keras
 * seperti tombol "Sync Sekarang" manual) — sync ini terjadi diam-diam
 * di background, kegagalannya tidak seharusnya terasa seperti error
 * yang harus segera ditindaklanjuti user.
 *
 * `useRef` mencegah efek jalan dua kali (React StrictMode / re-render
 * berulang saat query lain di sekitar `AppSidebar` ikut invalidate) —
 * auto-sync cukup DICOBA sekali per mount app, bukan tiap kali salah
 * satu query dependency berubah.
 */
export function useRetailkuAutoSync() {
  const queryClient = useQueryClient();
  const attempted = useRef(false);

  const { data: retailkuSettings } = useRetailkuSettings();
  const { data: mappings } = useRetailkuAccountMapping();
  const { data: syncSettings } = useRetailkuCashflowSyncSettings();
  const setSyncSettings = useSetRetailkuCashflowSyncSettings();

  useEffect(() => {
    if (attempted.current) return;
    if (!retailkuSettings || !mappings || !syncSettings) return;

    attempted.current = true;

    const hasCredentials = !!retailkuSettings.mcpUrl && !!retailkuSettings.apiKey;
    const hasMappings = mappings.length > 0;
    const today = todayIso();

    if (!syncSettings.autoSyncEnabled) return;
    if (syncSettings.lastAutoSyncDate === today) return;
    if (!hasCredentials || !hasMappings) return;
    if (
      syncSettings.arApCashAccountId == null ||
      syncSettings.receivableDebtAccountId == null ||
      syncSettings.payableDebtAccountId == null ||
      !syncSettings.syncFrom
    ) {
      return;
    }

    const config = assertRetailkuConfigured(retailkuSettings);

    syncAll({
      mcpConfig: config,
      arApCashAccountId: syncSettings.arApCashAccountId,
      receivableDebtAccountId: syncSettings.receivableDebtAccountId,
      payableDebtAccountId: syncSettings.payableDebtAccountId,
      dateFrom: syncSettings.syncFrom,
      dateTo: today,
      timezone: "Asia/Jakarta",
      mode: syncSettings.syncMode,
    })
      .then((result) => {
        setSyncSettings.mutate({ syncFrom: today, lastAutoSyncDate: today });
        QUERY_DEPENDENCIES.transactions.forEach((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        );
        queryClient.invalidateQueries({ queryKey: retailkuCashflowSyncSettingsQueryKey });

        toast.success("Sinkronisasi Retailku otomatis berhasil");
        if (result.cashflowUnmappedKeys.length > 0) {
          toast.warning(
            `${result.cashflowUnmappedKeys.length} jenis transaksi Retailku belum dipetakan — baris kasnya di-skip.`
          );
        }
        if (result.cashflowDeactivatedPaymentMethodAccountIds.length > 0) {
          toast.warning(
            `${result.cashflowDeactivatedPaymentMethodAccountIds.length} akun kas Retailku sudah dinonaktifkan sebagai payment method — baris kasnya di-skip.`
          );
        }
      })
      .catch((err) => {
        const detail = err instanceof Error ? err.message : String(err);
        toast.warning(`Sinkronisasi Retailku otomatis gagal: ${detail}`);
      });
  }, [retailkuSettings, mappings, syncSettings, setSyncSettings, queryClient]);
}

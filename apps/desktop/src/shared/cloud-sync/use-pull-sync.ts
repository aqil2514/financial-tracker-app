"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useCloudSyncSettings,
  useSetCloudSyncCheckpoint,
} from "./use-cloud-sync-settings";
import { pullSync } from "./worker-client";
import { applySyncResponse } from "./pull-sync";
import { retryPendingPushes } from "./push-on-write";

/**
 * Pull sekali saat app dibuka (kalau `cloud_sync_enabled` + kredensial
 * lengkap) -- lihat "Logic pull" di
 * docs/todos/plan/mcp-server-cloud-mirror.md. Best-effort/non-blocking,
 * pola SAMA dgn `useRetailkuMappingIssues` (silently skip kalau offline/
 * gagal, TIDAK menunda render apa pun atau melempar error ke UI).
 *
 * Dipasang SEKALI di root (`app/providers.tsx`), bukan per-halaman --
 * pull hanya perlu terjadi sekali per sesi app terbuka, bukan tiap
 * navigasi. `useRef` mencegah pull dobel akibat React StrictMode /
 * re-render Settings berubah.
 */
export function useAutoPullSync() {
  const { data: settings } = useCloudSyncSettings();
  const setCheckpoint = useSetCloudSyncCheckpoint();
  const queryClient = useQueryClient();
  const hasPulledRef = useRef(false);

  const enabled = !!settings?.enabled && !!settings.workerUrl && !!settings.token;

  useEffect(() => {
    if (!enabled || hasPulledRef.current) return;
    hasPulledRef.current = true;

    (async () => {
      try {
        // Retry antrian push gagal DULU -- supaya perubahan lokal yang
        // belum sempat terkirim (mis. app ditutup saat offline) jalan
        // sebelum pull, lebih kecil kemungkinan ketiban "race" dgn
        // perubahan dari sisi lain yang datang lewat pull berikutnya.
        await retryPendingPushes();

        const response = await pullSync(
          { workerUrl: settings!.workerUrl!, token: settings!.token! },
          settings!.lastCheckpoint
        );
        await applySyncResponse(response);
        await setCheckpoint.mutateAsync(response.checkpoint);
        // Semua query data (transactions/accounts/dst) berpotensi stale
        // setelah pull menulis langsung ke SQLite di luar jalur mutation
        // biasa -- invalidate semua query data domain supaya UI refresh.
        await queryClient.invalidateQueries();
      } catch {
        // Best-effort: offline/Worker down/token salah -- diam-diam
        // skip, dicoba lagi di sesi berikutnya. Tombol "Tes Koneksi" di
        // Settings sudah menangani feedback eksplisit utk kredensial
        // salah.
        hasPulledRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

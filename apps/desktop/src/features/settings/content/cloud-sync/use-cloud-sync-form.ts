"use client";

import { useEffect, useState } from "react";

import {
  testCloudSyncConnection,
  type CloudSyncCredentials,
} from "@/shared/cloud-sync/worker-client";
import { useCloudSyncSettings, useSetCloudSyncSettings } from "@/shared/cloud-sync/use-cloud-sync-settings";
import { backfillSync, type BackfillProgress, type BackfillSummary } from "@/shared/cloud-sync/backfill-sync";

export type CloudSyncConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success" }
  | { status: "error" };

export type BackfillState =
  | { status: "idle" }
  | { status: "running"; progress: BackfillProgress | null }
  | { status: "done"; summary: BackfillSummary }
  | { status: "error" };

/**
 * State + logic untuk `CloudSyncForm` — draft enabled/URL/token di
 * `useState`, disinkronkan dari kredensial tersimpan begitu datang,
 * plus "Tes Koneksi" (panggil /health, TANPA menulis apa pun) sebelum
 * toggle benar-benar bisa diaktifkan. Pola sama dengan
 * `use-retailku-settings-form.ts`.
 */
export function useCloudSyncForm() {
  const { data: settings, isLoading } = useCloudSyncSettings();
  const setSettings = useSetCloudSyncSettings();

  const [enabled, setEnabled] = useState(false);
  const [workerUrl, setWorkerUrl] = useState("");
  const [token, setToken] = useState("");
  const [testState, setTestState] = useState<CloudSyncConnectionTestState>({ status: "idle" });
  const [backfillState, setBackfillState] = useState<BackfillState>({ status: "idle" });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setWorkerUrl(settings.workerUrl ?? "");
      setToken(settings.token ?? "");
    }
  }, [settings]);

  function handleSave() {
    setSettings.mutate({
      enabled,
      workerUrl: workerUrl.trim() || null,
      token: token.trim() || null,
    });
  }

  async function handleTestConnection() {
    setTestState({ status: "testing" });
    const creds: CloudSyncCredentials = { workerUrl: workerUrl.trim(), token: token.trim() };
    const ok = await testCloudSyncConnection(creds);
    setTestState({ status: ok ? "success" : "error" });
  }

  /** "Sync Semua Data Sekarang" -- push SEMUA data lokal existing ke
   * Worker sekali jalan (lihat backfill-sync.ts utk alasan ini perlu
   * ada: push-on-write cuma mengirim data BARU, transaksi lama yang
   * merujuk akun lama akan ditolak Worker dgn FK error kalau akunnya
   * belum pernah ter-push). Dipicu manual, BUKAN otomatis saat toggle
   * ON -- keputusan 2026-10-01, supaya user sadar kapan proses (bisa
   * lama utk data banyak) ini berjalan. */
  async function handleBackfill() {
    setBackfillState({ status: "running", progress: null });
    try {
      const creds: CloudSyncCredentials = { workerUrl: workerUrl.trim(), token: token.trim() };
      const summary = await backfillSync(creds, (progress) => {
        setBackfillState({ status: "running", progress });
      });
      setBackfillState({ status: "done", summary });
    } catch {
      setBackfillState({ status: "error" });
    }
  }

  const canTest = !!workerUrl.trim() && !!token.trim();
  const canEnable = !!workerUrl.trim() && !!token.trim();
  const canBackfill = canTest && backfillState.status !== "running";

  return {
    enabled,
    setEnabled,
    workerUrl,
    setWorkerUrl,
    token,
    setToken,
    isLoading,
    canTest,
    canEnable,
    canBackfill,
    isSaving: setSettings.isPending,
    testState,
    backfillState,
    handleSave,
    handleTestConnection,
    handleBackfill,
  };
}

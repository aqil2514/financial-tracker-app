"use client";

import { useEffect, useState } from "react";

import {
  testCloudSyncConnection,
  type CloudSyncCredentials,
} from "@/shared/cloud-sync/worker-client";
import { useCloudSyncSettings, useSetCloudSyncSettings } from "@/shared/cloud-sync/use-cloud-sync-settings";

export type CloudSyncConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success" }
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

  const canTest = !!workerUrl.trim() && !!token.trim();
  const canEnable = !!workerUrl.trim() && !!token.trim();

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
    isSaving: setSettings.isPending,
    testState,
    handleSave,
    handleTestConnection,
  };
}

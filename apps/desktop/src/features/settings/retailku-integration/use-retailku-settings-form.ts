"use client";

import { useEffect, useState } from "react";

import { connectRetailkuMcp, useRetailkuSettings, useSetRetailkuSettings } from "@/shared/retailku";

export type RetailkuConnectionTestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "success"; toolCount: number }
  | { status: "error"; message: string };

/**
 * State + logic untuk `RetailkuSettingsForm` — draft URL MCP/API key di
 * `useState`, disinkronkan dari kredensial tersimpan begitu datang,
 * plus "Tes Koneksi" (connect ke MCP, listTools, lalu close) yang
 * tidak menulis apa pun ke database, cuma verifikasi manual.
 */
export function useRetailkuSettingsForm() {
  const { data: settings, isLoading } = useRetailkuSettings();
  const setSettings = useSetRetailkuSettings();

  const [mcpUrl, setMcpUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testState, setTestState] = useState<RetailkuConnectionTestState>({ status: "idle" });

  useEffect(() => {
    if (settings) {
      setMcpUrl(settings.mcpUrl ?? "");
      setApiKey(settings.apiKey ?? "");
    }
  }, [settings]);

  function handleSave() {
    setSettings.mutate({
      mcpUrl: mcpUrl.trim() || null,
      apiKey: apiKey.trim() || null,
    });
  }

  async function handleTestConnection() {
    setTestState({ status: "testing" });
    let client: Awaited<ReturnType<typeof connectRetailkuMcp>> | null = null;
    try {
      client = await connectRetailkuMcp({ mcpUrl: mcpUrl.trim(), apiKey: apiKey.trim() });
      const { tools } = await client.listTools();
      setTestState({ status: "success", toolCount: tools.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestState({ status: "error", message });
    } finally {
      await client?.close();
    }
  }

  const isConnected = !!settings?.mcpUrl && !!settings?.apiKey;
  const canTest = !!mcpUrl.trim() && !!apiKey.trim();

  return {
    mcpUrl,
    setMcpUrl,
    apiKey,
    setApiKey,
    isLoading,
    isConnected,
    canTest,
    isSaving: setSettings.isPending,
    testState,
    handleSave,
    handleTestConnection,
  };
}

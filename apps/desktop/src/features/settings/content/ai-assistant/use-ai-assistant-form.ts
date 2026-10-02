"use client";

import { useEffect, useState } from "react";

import {
  useAiAssistantSettings,
  useSetAiAssistantSettings,
} from "@/shared/ai-assistant/use-ai-assistant-settings";

/**
 * State + logic untuk `AiAssistantForm` — draft URL/token di
 * `useState`, disinkronkan dari nilai tersimpan begitu datang. Tidak
 * ada toggle/tes-koneksi di sini (beda dari `use-cloud-sync-form.ts`)
 * krn PC tidak pernah memanggil apps/mcp-server — section ini murni
 * tempat simpan+tampilkan info utk di-copy-paste user ke client MCP.
 */
export function useAiAssistantForm() {
  const { data: settings, isLoading } = useAiAssistantSettings();
  const setSettings = useSetAiAssistantSettings();

  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    if (settings) {
      setServerUrl(settings.serverUrl ?? "");
      setToken(settings.token ?? "");
    }
  }, [settings]);

  function handleSave() {
    setSettings.mutate({
      serverUrl: serverUrl.trim() || null,
      token: token.trim() || null,
    });
  }

  return {
    serverUrl,
    setServerUrl,
    token,
    setToken,
    isLoading,
    isSaving: setSettings.isPending,
    handleSave,
  };
}

"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const SERVER_URL_KEY = "mcp_server_url";
const TOKEN_KEY = "mcp_sync_token";

export const aiAssistantSettingsQueryKey = ["settings", "ai-assistant"];

/**
 * Info koneksi MCP server (apps/mcp-server) utk ditampilkan balik ke
 * user -- lihat apps/worker/docs/todos/plan/cloud-sync.md "Tahap 5".
 * PC TIDAK PERNAH memanggil mcp-server sama sekali (beda dari
 * cloud-sync yg PC panggil Worker langsung) -- section ini murni
 * tempat simpan+tampilkan URL & token supaya user gampang copy-paste
 * ke client MCP (Claude Desktop/Web dll) saat setup koneksi.
 */
export type AiAssistantSettings = {
  serverUrl: string | null;
  token: string | null;
};

const SETTINGS_KEYS = [SERVER_URL_KEY, TOKEN_KEY];

export function useAiAssistantSettings() {
  return useQuery({
    queryKey: aiAssistantSettingsQueryKey,
    queryFn: async (): Promise<AiAssistantSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        `SELECT key, value FROM settings WHERE key IN (${SETTINGS_KEYS.map((_, i) => `$${i + 1}`).join(", ")})`,
        SETTINGS_KEYS
      );
      const get = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
      return {
        serverUrl: get(SERVER_URL_KEY),
        token: get(TOKEN_KEY),
      };
    },
  });
}

export function useSetAiAssistantSettings() {
  return useDbMutation({
    mutationFn: async (settings: { serverUrl: string | null; token: string | null }) => {
      const db = await getDb();
      const entries: [string, string | null][] = [
        [SERVER_URL_KEY, settings.serverUrl],
        [TOKEN_KEY, settings.token],
      ];
      for (const [key, value] of entries) {
        await db.execute(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, value]
        );
      }
    },
    invalidateKey: aiAssistantSettingsQueryKey,
    successMessage: "Pengaturan AI Assistant berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan AI Assistant",
  });
}

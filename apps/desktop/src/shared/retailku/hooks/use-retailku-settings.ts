"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";

const MCP_URL_KEY = "retailku_mcp_url";
const API_KEY_KEY = "retailku_api_key";

export const retailkuSettingsQueryKey = ["settings", "retailku"];

export type RetailkuSettings = {
  mcpUrl: string | null;
  apiKey: string | null;
};

export function useRetailkuSettings() {
  return useQuery({
    queryKey: retailkuSettingsQueryKey,
    queryFn: async (): Promise<RetailkuSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        "SELECT key, value FROM settings WHERE key IN ($1, $2)",
        [MCP_URL_KEY, API_KEY_KEY]
      );
      return {
        mcpUrl: rows.find((row) => row.key === MCP_URL_KEY)?.value ?? null,
        apiKey: rows.find((row) => row.key === API_KEY_KEY)?.value ?? null,
      };
    },
  });
}

export function useSetRetailkuSettings() {
  return useDbMutation({
    mutationFn: async (settings: RetailkuSettings) => {
      const db = await getDb();
      const entries: [string, string | null][] = [
        [MCP_URL_KEY, settings.mcpUrl],
        [API_KEY_KEY, settings.apiKey],
      ];
      for (const [key, value] of entries) {
        await db.execute(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          [key, value]
        );
      }
    },
    invalidateKey: retailkuSettingsQueryKey,
    successMessage: "Pengaturan Retailku berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan Retailku",
  });
}

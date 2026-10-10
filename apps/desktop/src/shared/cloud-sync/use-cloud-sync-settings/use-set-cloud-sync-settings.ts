"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { cloudSyncSettingsQueryKey, ENABLED_KEY, TOKEN_KEY, WORKER_URL_KEY } from "./keys";

export function useSetCloudSyncSettings() {
  return useDbMutation({
    mutationFn: async (settings: { enabled: boolean; workerUrl: string | null; token: string | null }) => {
      const db = await getDb();
      const entries: [string, string | null][] = [
        [ENABLED_KEY, settings.enabled ? "1" : "0"],
        [WORKER_URL_KEY, settings.workerUrl],
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
    invalidateKey: cloudSyncSettingsQueryKey,
    successMessage: "Pengaturan cloud sync berhasil disimpan",
    errorMessage: "Gagal menyimpan pengaturan cloud sync",
  });
}

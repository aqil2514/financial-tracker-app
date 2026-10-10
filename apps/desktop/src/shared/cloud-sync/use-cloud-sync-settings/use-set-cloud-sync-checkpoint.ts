"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { cloudSyncSettingsQueryKey, LAST_CHECKPOINT_KEY } from "./keys";

export function useSetCloudSyncCheckpoint() {
  return useDbMutation({
    mutationFn: async (checkpoint: string) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [LAST_CHECKPOINT_KEY, checkpoint]
      );
    },
    invalidateKey: cloudSyncSettingsQueryKey,
    successMessage: "",
    errorMessage: "Gagal menyimpan checkpoint sync",
    silent: true,
  });
}

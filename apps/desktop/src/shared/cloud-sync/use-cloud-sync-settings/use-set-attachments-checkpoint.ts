"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { ATTACHMENTS_CHECKPOINT_KEY, cloudSyncSettingsQueryKey } from "./keys";

export function useSetAttachmentsCheckpoint() {
  return useDbMutation({
    mutationFn: async (checkpoint: string) => {
      const db = await getDb();
      await db.execute(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [ATTACHMENTS_CHECKPOINT_KEY, checkpoint]
      );
    },
    invalidateKey: cloudSyncSettingsQueryKey,
    successMessage: "",
    errorMessage: "Gagal menyimpan checkpoint attachment",
    silent: true,
  });
}

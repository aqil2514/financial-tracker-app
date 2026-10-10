"use client";

import { useQuery } from "@tanstack/react-query";

import { getDb } from "@/lib/db";
import {
  ATTACHMENTS_CHECKPOINT_KEY,
  cloudSyncSettingsQueryKey,
  ENABLED_KEY,
  LAST_CHECKPOINT_KEY,
  SETTINGS_KEYS,
  TOKEN_KEY,
  WORKER_URL_KEY,
} from "./keys";
import type { CloudSyncSettings } from "./types";

export function useCloudSyncSettings() {
  return useQuery({
    queryKey: cloudSyncSettingsQueryKey,
    queryFn: async (): Promise<CloudSyncSettings> => {
      const db = await getDb();
      const rows = await db.select<{ key: string; value: string | null }[]>(
        `SELECT key, value FROM settings WHERE key IN (${SETTINGS_KEYS.map((_, i) => `$${i + 1}`).join(", ")})`,
        SETTINGS_KEYS
      );
      const get = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
      return {
        enabled: get(ENABLED_KEY) === "1",
        workerUrl: get(WORKER_URL_KEY),
        token: get(TOKEN_KEY),
        lastCheckpoint: get(LAST_CHECKPOINT_KEY),
        lastAttachmentsCheckpoint: get(ATTACHMENTS_CHECKPOINT_KEY),
      };
    },
  });
}

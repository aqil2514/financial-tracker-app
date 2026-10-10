import { getDb } from "@/lib/db";
import type { CloudSyncCredentials } from "../worker-client";

export async function resolveCredentials(): Promise<CloudSyncCredentials | null> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string | null }[]>(
    "SELECT key, value FROM settings WHERE key IN ('cloud_sync_enabled', 'cloud_sync_worker_url', 'cloud_sync_token')"
  );
  const get = (key: string) => rows.find((row) => row.key === key)?.value ?? null;
  const enabled = get("cloud_sync_enabled") === "1";
  const workerUrl = get("cloud_sync_worker_url");
  const token = get("cloud_sync_token");
  if (!enabled || !workerUrl || !token) return null;
  return { workerUrl, token };
}

import type { SQLiteDatabase } from "expo-sqlite";
import { getSyncToken } from "./credentials";
import { getSyncState } from "./sync-state";
import type { CloudSyncCredentials } from "./types";

// URL dari cloud_sync_state, token dari SecureStore. Null kalau salah satunya belum diisi (sync tidak aktif).
export async function resolveCredentials(db: SQLiteDatabase): Promise<CloudSyncCredentials | null> {
  const { workerUrl } = await getSyncState(db);
  const token = await getSyncToken();
  if (!workerUrl || !token) return null;
  return { workerUrl, token };
}

import type { SQLiteDatabase } from "expo-sqlite";
import { applySyncResponse } from "./apply-sync-response";
import type { SyncResponse } from "./pull-types";
import { getSyncState, setCheckpoint, withApplyingPull } from "./sync-state";
import type { CloudSyncCredentials } from "./types";
import { workerRequest, type FetchLike } from "./worker-client";

export type PullResult = { applied: number; rejected: number; skipped: number; checkpointAdvanced: boolean };

let inFlight: Promise<PullResult> | null = null;

// Satu pull pada satu waktu. Checkpoint hanya maju kalau SEMUA baris berhasil diterapkan: baris yang gagal
// tidak boleh jatuh di belakang checkpoint, karena Worker tidak akan mengirimnya lagi. Akibatnya baris yang
// gagal sementara membuat pull berikutnya mengirim ulang rentang yang sama (aman: LWW membuatnya no-op).
export function runPull(db: SQLiteDatabase, creds: CloudSyncCredentials, fetchImpl?: FetchLike): Promise<PullResult> {
  if (inFlight) return inFlight;
  inFlight = run(db, creds, fetchImpl).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(db: SQLiteDatabase, creds: CloudSyncCredentials, fetchImpl?: FetchLike): Promise<PullResult> {
  const { checkpoint } = await getSyncState(db);
  const query = checkpoint ? `?since=${encodeURIComponent(checkpoint)}` : "";
  const response = await workerRequest<SyncResponse>(creds, `/sync${query}`, {}, fetchImpl);

  const fullSnapshot = checkpoint === null;
  const { applied, rejected, skipped } = await withApplyingPull(db, () =>
    applySyncResponse(db, response, { fullSnapshot })
  );

  const checkpointAdvanced = rejected === 0;
  if (checkpointAdvanced) await setCheckpoint(db, response.checkpoint);
  return { applied, rejected, skipped, checkpointAdvanced };
}

/**
 * Titik panggil push-on-write -- dipakai dari dalam `mutationFn` tiap
 * hook create/update/delete (lihat "Logic push ON-WRITE" di
 * docs/todos/plan/mcp-server-cloud-mirror.md). Baca kredensial LANGSUNG
 * dari tabel `settings` via SQL (bukan `useCloudSyncSettings()` -- hook
 * React Query tidak bisa dipanggil di dalam `mutationFn`, yang jalan di
 * luar render React), supaya modul ini tetap dipanggil dari fungsi
 * biasa, bukan hook.
 *
 * Async non-blocking: SEMUA fungsi di sini TIDAK boleh melempar error
 * ke caller (mutationFn hook) -- kegagalan push bukan kegagalan
 * operasi lokal. Gagal/offline -> masuk antrian retry, mutationFn tetap
 * resolve normal.
 */

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, DeleteCloudPayload } from "./worker-client";
import { deleteCloudRow } from "./worker-client";
import {
  enqueueDeletePush,
  enqueueUpsertPush,
  flushPushQueue,
  type DeletableTable,
  type QueueableTable,
} from "./push-queue";
import { pushRowPayload } from "./push-row";

async function resolveCredentials(): Promise<CloudSyncCredentials | null> {
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

/** Panggil setelah INSERT/UPDATE lokal sukses -- push baris ke Worker
 * segera, masuk antrian kalau gagal/offline. */
export async function pushOnWrite(table: QueueableTable, id: string): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;

  try {
    const result = await pushRowPayload(creds, table, id);
    // 'rejected' (422, validasi bisnis Worker) TIDAK di-retry -- data
    // lokal valid menurut desktop sendiri, payload yang sama akan
    // ditolak lagi tanpa ada yang berubah. Dibiarkan sbg divergence
    // sampai user edit ulang (akan push lagi dgn data baru).
    if (!result || result.status === "rejected") return;
  } catch {
    await enqueueUpsertPush(table, id);
  }
}

/** Panggil SEBELUM hard-delete lokal (keputusan 2026-10-01) -- supaya
 * kalau push gagal/offline, delete lokal TETAP lanjut (desktop
 * offline-first, tidak boleh diblokir internet) dan masuk antrian
 * retry dgn payload action yang sama. */
export async function pushDeleteOnWrite(
  table: DeletableTable,
  id: string,
  payload: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;

  try {
    await deleteCloudRow(creds, table, id, payload);
  } catch {
    await enqueueDeletePush(table, id, payload);
  }
}

/** Jalankan ulang antrian retry -- dipanggil saat app dibuka (bareng
 * pull). Best-effort, diam-diam skip kalau offline/kredensial belum
 * lengkap. */
export async function retryPendingPushes(): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;
  await flushPushQueue(creds);
}

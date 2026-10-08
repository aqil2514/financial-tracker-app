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
import type { CloudSyncCredentials, DeleteCloudPayload, TransactionDebtInfo } from "./worker-client";
import { deleteCloudRow, deleteTransactionCloud } from "./worker-client";
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

/** Khusus `transactions` -- terpisah dari `pushDeleteOnWrite` krn
 * py bentuk return beda (bukan void): endpoint Worker balas `debtInfo`
 * (tindakan thd debt/debt_payments terkait, TUNGGAL per role, TANPA
 * payload pilihan dari client), dipakai dialog PC utk toast informatif
 * SETELAH delete berhasil. `null` kalau offline/gagal (masuk antrian
 * retry, sama kebijakan non-blocking dgn pushDeleteOnWrite) ATAU kalau
 * cloud sync belum aktif -- caller treat sbg "tidak ada info tambahan
 * utk ditampilkan", BUKAN error. */
export async function pushDeleteTransactionOnWrite(id: string): Promise<TransactionDebtInfo | null> {
  const creds = await resolveCredentials();
  if (!creds) return null;

  try {
    return await deleteTransactionCloud(creds, id);
  } catch {
    await enqueueDeletePush("transactions", id, {});
    return null;
  }
}

/** Khusus `transaction_attachments` -- `pushDeleteOnWrite` generik juga
 * cocok (endpoint `DELETE /attachments/:id` TANPA payload action, sama
 * bentuknya dgn `contacts`/`transactions`), tapi dibungkus fungsi
 * terpisah supaya caller (`use-delete-attachment.ts`) tidak perlu tahu
 * payload kosong `{}` yang wajib dikirim utk tipe `DeleteCloudPayload`. */
export async function pushDeleteAttachmentOnWrite(id: string): Promise<void> {
  await pushDeleteOnWrite("transaction_attachments", id, {});
}

/** Jalankan ulang antrian retry -- dipanggil saat app dibuka (bareng
 * pull). Best-effort, diam-diam skip kalau offline/kredensial belum
 * lengkap. */
export async function retryPendingPushes(): Promise<void> {
  const creds = await resolveCredentials();
  if (!creds) return;
  await flushPushQueue(creds);
}

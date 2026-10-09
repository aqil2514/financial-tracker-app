/**
 * Antrian retry untuk push on-write yang gagal (offline/request gagal
 * saat terjadi) -- lihat migrasi `0029_cloud_sync_queue.sql`+
 * `0030_cloud_sync_queue_payload.sql` dan "Retry/antrian" di
 * docs/todos/plan/mcp-server-cloud-mirror.md.
 *
 * Isi antrian `{table, id, op}` (BUKAN payload penuh, keputusan
 * 2026-10-01): saat retry utk op='upsert', baca ULANG row terbaru dari
 * SQLite lokal lalu push -- selalu dapat data terbaru kalau row itu
 * diedit lagi sebelum retry sempat jalan. PENGECUALIAN: op='delete'
 * WAJIB simpan `payload` (action reassign/unassign) krn row sudah
 * hard-deleted lokal di titik enqueue -- tidak ada apa pun utk dibaca
 * ulang, actionnya keputusan SESAAT user saat klik delete.
 *
 * `transactions` ikut antrian delete jg sejak 2026-10-03 (endpoint
 * Worker `DELETE /transactions/:id` sudah ada) -- payload action-nya
 * SELALU kosong (`{}`), beda dari account_groups/accounts/categories
 * yg py reassign/unassign opsional (tindakan thd debt/debt_payments
 * terkait di Worker TUNGGAL per role, bukan pilihan client). `debtInfo`
 * hasil retry delete transaksi DIABAIKAN (bukan ditampilkan via toast)
 * -- beda dari delete langsung yg dialognya masih terbuka, retry jalan
 * di background tanpa ada yg menunggu pesan spesifik.
 */

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, DeleteCloudPayload } from "./worker-client";
import { deleteCloudRow } from "./worker-client";
import { pushRowPayload } from "./push-row";

export type QueueableTable =
  | "transactions"
  | "accounts"
  | "account_groups"
  | "categories"
  | "contacts"
  | "debts"
  | "debt_payments"
  | "investment_accounts"
  | "investment_purchases"
  | "investment_sales"
  | "transaction_attachments"
  | "labels"
  | "transaction_labels"
  | "category_labels"
  | "account_labels";
export type DeletableTable = DeleteCloudPayload["table"];

export async function enqueueUpsertPush(table: QueueableTable, id: string) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO cloud_sync_queue (table_name, row_id, op, payload) VALUES ($1, $2, 'upsert', NULL)
     ON CONFLICT(table_name, row_id) DO UPDATE SET op = 'upsert', payload = NULL, attempts = 0, last_error = NULL`,
    [table, id]
  );
}

export async function enqueueDeletePush(
  table: DeletableTable,
  id: string,
  payload: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO cloud_sync_queue (table_name, row_id, op, payload) VALUES ($1, $2, 'delete', $3)
     ON CONFLICT(table_name, row_id) DO UPDATE SET op = 'delete', payload = excluded.payload, attempts = 0, last_error = NULL`,
    [table, id, JSON.stringify(payload ?? {})]
  );
}

async function markAttemptFailed(queueId: number, error: string) {
  const db = await getDb();
  await db.execute(
    "UPDATE cloud_sync_queue SET attempts = attempts + 1, last_error = $1 WHERE id = $2",
    [error, queueId]
  );
}

async function removeFromQueue(queueId: number) {
  const db = await getDb();
  await db.execute("DELETE FROM cloud_sync_queue WHERE id = $1", [queueId]);
}

/** Jalankan ulang SEMUA entry antrian, urut dari yang paling lama.
 * Dipanggil saat app dibuka (bareng pull) DAN setelah tiap push
 * langsung gagal (percobaan ulang segera, bukan nunggu sesi berikutnya).
 * Best-effort: entry yang gagal lagi TETAP di antrian (attempts++),
 * TIDAK melempar error ke caller. */
export async function flushPushQueue(creds: CloudSyncCredentials): Promise<void> {
  const db = await getDb();
  const entries = await db.select<
    { id: number; table_name: QueueableTable; row_id: string; op: "upsert" | "delete"; payload: string | null }[]
  >("SELECT id, table_name, row_id, op, payload FROM cloud_sync_queue ORDER BY id ASC");

  for (const entry of entries) {
    try {
      if (entry.op === "delete") {
        const payload = entry.payload ? JSON.parse(entry.payload) : {};
        await deleteCloudRow(creds, entry.table_name as DeletableTable, entry.row_id, payload);
      } else {
        const result = await pushRowPayload(creds, entry.table_name, entry.row_id);
        if (result?.status === "rejected") {
          // Validasi bisnis Worker menolak -- retry tidak akan pernah
          // berhasil tanpa perubahan data, TAPI tetap disimpan di
          // antrian (bukan dihapus diam-diam) supaya terlihat di
          // attempts/last_error utk investigasi, bukan hilang senyap.
          await markAttemptFailed(entry.id, `rejected: ${result.reason}`);
          continue;
        }
      }
      await removeFromQueue(entry.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markAttemptFailed(entry.id, message);
    }
  }
}

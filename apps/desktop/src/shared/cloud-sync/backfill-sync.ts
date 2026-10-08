/**
 * Backfill manual: push SEMUA data lokal existing ke Worker, sekali
 * jalan -- dipicu tombol "Sync Semua Data Sekarang" di Settings (lihat
 * docs/todos/plan/mcp-server-cloud-mirror.md, bagian ditambah
 * 2026-10-01).
 *
 * KENAPA INI PERLU: push-on-write (`push-on-write.ts`) cuma mengirim
 * baris yang DITULIS SETELAH fitur ini aktif -- data yang sudah lama
 * ada di SQLite lokal SEBELUM toggle ON tidak pernah otomatis ter-push.
 * Begitu user bikin transaksi baru yang merujuk akun LAMA (belum pernah
 * ter-push), Worker menolak dgn FOREIGN KEY constraint (akun itu belum
 * ada di D1) -- DITEMUKAN nyata saat verifikasi end-to-end 2026-10-01,
 * bukan dugaan.
 *
 * Urutan WAJIB ikut dependency FK -- sama seperti `pull-sync.ts` tapi
 * arah terbalik: account_groups dulu (tidak referensi apa pun), lalu
 * categories+contacts (independen satu sama lain), baru accounts
 * (referensi account_groups), baru transactions (referensi ketiganya).
 * `debts`/`debt_payments` TIDAK di-push di sini (SENGAJA SKIP, sama
 * seperti push-on-write -- tidak ada endpoint POST langsung di Worker,
 * lihat catatan di worker-client.ts).
 *
 * `transaction_attachments` di-push PALING AKHIR (setelah `transactions`,
 * referensi FK-nya) -- ini SEKALIGUS jawaban eksekusi utk open question
 * "migrasi lampiran lama ke R2" di attachment-r2-sync.md: backfill ini
 * reuse `pushRowPayload` case `transaction_attachments` yang SAMA dgn
 * push-on-write biasa (baca ulang `file_path` dari disk + upload), jadi
 * TIDAK perlu jalur terpisah -- cukup tombol yang sama, sekali jalan,
 * mengirim SEMUA lampiran lokal (baru maupun lama) yang belum pernah
 * ter-push.
 *
 * BUG DITEMUKAN SAAT verifikasi production 2026-10-01: `categories`
 * SELF-REFERENCING (`parent_id -> categories.id`) -- `SELECT id FROM
 * categories` TIDAK menjamin induk terkirim sebelum anaknya, jadi
 * sub-kategori yang kebetulan ter-push duluan ditolak Worker (FK
 * constraint), efek domino ke transaksi yang pakai kategori itu.
 * Diverifikasi di data nyata: hierarki cuma 2 LEVEL (tidak ada
 * grandparent), jadi cukup push `parent_id IS NULL` dulu baru
 * `parent_id IS NOT NULL` -- BUKAN solusi umum N-level, tapi cukup utk
 * data yang ada sekarang.
 *
 * TIDAK soft-deleted (`deleted_at IS NULL` difilter di level WHERE
 * lokal) -- baris yang sudah dihapus di PC tidak perlu di-backfill
 * (desktop 100% hard-delete, baris itu sudah tidak ada sama sekali).
 */

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials } from "./worker-client";
import { pushRowPayload } from "./push-row";
import type { QueueableTable } from "./push-queue";

export type BackfillProgress = {
  table: QueueableTable;
  done: number;
  total: number;
};

export type BackfillSummary = {
  pushed: number;
  rejected: number;
  failed: number;
};

const BACKFILL_ORDER: QueueableTable[] = [
  "account_groups",
  "categories",
  "contacts",
  "accounts",
  "transactions",
  "transaction_attachments",
];

async function getAllIds(table: QueueableTable): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(`SELECT id FROM ${table}`);
  return rows.map((row) => row.id);
}

/** Khusus categories: induk (parent_id IS NULL) dulu, baru sub-kategori
 * -- lihat catatan "BUG DITEMUKAN" di atas file ini. */
async function getCategoryIdsParentsFirst(): Promise<string[]> {
  const db = await getDb();
  const parents = await db.select<{ id: string }[]>(
    "SELECT id FROM categories WHERE parent_id IS NULL"
  );
  const children = await db.select<{ id: string }[]>(
    "SELECT id FROM categories WHERE parent_id IS NOT NULL"
  );
  return [...parents.map((row) => row.id), ...children.map((row) => row.id)];
}

async function pushTable(
  creds: CloudSyncCredentials,
  table: QueueableTable,
  ids: string[],
  summary: BackfillSummary,
  onProgress?: (progress: BackfillProgress) => void
): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    try {
      const result = await pushRowPayload(creds, table, ids[i]);
      if (result?.status === "rejected") summary.rejected++;
      else summary.pushed++;
    } catch {
      summary.failed++;
    }
    onProgress?.({ table, done: i + 1, total: ids.length });
  }
}

/** Push SEMUA baris lokal ke Worker, urut FK. Best-effort per baris --
 * satu baris gagal TIDAK menghentikan sisanya (supaya satu transaksi
 * bermasalah tidak memblokir ratusan baris lain yang valid). Caller
 * (UI tombol) dapat callback progress utk ditampilkan real-time. */
export async function backfillSync(
  creds: CloudSyncCredentials,
  onProgress?: (progress: BackfillProgress) => void
): Promise<BackfillSummary> {
  const summary: BackfillSummary = { pushed: 0, rejected: 0, failed: 0 };

  for (const table of BACKFILL_ORDER) {
    const ids = table === "categories" ? await getCategoryIdsParentsFirst() : await getAllIds(table);
    await pushTable(creds, table, ids, summary, onProgress);
  }

  return summary;
}

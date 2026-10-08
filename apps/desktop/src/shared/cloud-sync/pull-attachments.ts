/**
 * Pull lampiran transaksi dari Worker/R2 -- lihat
 * apps/worker/docs/todos/plan/attachment-r2-sync.md "Sisi desktop: push
 * & pull". BEDA dari `pull-sync.ts` (tabel data biasa): tidak ada LWW
 * "versi lama vs baru" utk satu file -- begitu ada row attachment baru
 * dari Worker yang filenya belum ada lokal, cukup DOWNLOAD SEKALI, tidak
 * ada compare `updated_at` incoming vs lokal (skema lokal bahkan tidak
 * py kolom itu).
 */

import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials } from "./worker-client";
import { listAttachmentsSince, getAttachmentBytes } from "./worker-client";

async function hasLocalRow(table: string, id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ id: string }[]>(`SELECT id FROM ${table} WHERE id = $1`, [id]);
  return rows.length > 0;
}

async function hasLocalTransaction(transactionId: string): Promise<boolean> {
  return hasLocalRow("transactions", transactionId);
}

/** Terapkan daftar attachment dari Worker ke SQLite+disk lokal. Dipanggil
 * dari `useAutoPullSync` bareng `applySyncResponse` (tabel data biasa).
 * `targetDir` sama dgn yang dipakai `useAddAttachment` (`attachment_folder`
 * setting, null = folder default app data dir Rust-side). Return
 * `checkpoint` -- caller (useAutoPullSync) yang simpan via
 * `useSetAttachmentsCheckpoint` SETELAH resolve sukses, sama pola dgn
 * `applySyncResponse`/`response.checkpoint`. */
export async function pullAttachments(
  creds: CloudSyncCredentials,
  since: string | null,
  targetDir: string | null
): Promise<string> {
  const { checkpoint, attachments } = await listAttachmentsSince(creds, since);
  const db = await getDb();

  for (const item of attachments) {
    if (item.deletedAt !== null) {
      // Row sudah di-hard-delete dari R2 di sisi Worker -- kalau masih
      // ada lokal, hapus file fisik dulu (best-effort, sama pola
      // use-delete-attachment.ts) baru hapus row.
      const rows = await db.select<{ file_path: string }[]>(
        "SELECT file_path FROM transaction_attachments WHERE id = $1",
        [item.id]
      );
      const localFilePath = rows[0]?.file_path;
      if (localFilePath) {
        await invoke("delete_attachment_file", { filePath: localFilePath }).catch(() => undefined);
        await db.execute("DELETE FROM transaction_attachments WHERE id = $1", [item.id]);
      }
      continue;
    }

    // Attachment baru dari device/HP lain -- transaksi induknya WAJIB
    // sudah ada lokal (biasanya sudah, krn applySyncResponse tabel
    // transactions jalan SEBELUM ini di useAutoPullSync). Kalau belum
    // (race/pull parsial), skip -- akan ke-pull lagi next cycle setelah
    // transaksi induknya datang (since belum maju krn checkpoint belum
    // disimpan saat ini masih gagal).
    if (!(await hasLocalTransaction(item.transactionId))) continue;

    const alreadyLocal = await hasLocalRow("transaction_attachments", item.id);
    if (alreadyLocal) continue;

    const { bytes } = await getAttachmentBytes(creds, item.id);
    const ext = item.contentType?.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
    const filePath = await invoke<string>("save_attachment_bytes", {
      bytes: Array.from(bytes),
      originalName: `${item.id}.${ext}`,
      targetDir,
    });
    await db.execute(
      "INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES ($1, $2, $3)",
      [item.id, item.transactionId, filePath]
    );
  }

  return checkpoint;
}

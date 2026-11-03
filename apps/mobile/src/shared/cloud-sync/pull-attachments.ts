import type { SQLiteDatabase } from "expo-sqlite";
import { loadDefaultAttachmentTransport, type AttachmentTransport } from "./attachment-transport-types";
import { clearRejected, logRejected } from "./rejected-log";
import { getSyncState, setAttachmentCheckpoint, withApplyingPull } from "./sync-state";
import type { CloudSyncCredentials } from "./types";
import { workerRequest, type FetchLike } from "./worker-client";

type AttachmentListItem = {
  id: string;
  transactionId: string;
  contentType: string | null;
  sizeBytes: number | null;
  updatedAt: string | null;
  deletedAt: string | null;
};

type AttachmentListResponse = { checkpoint: string; attachments: AttachmentListItem[] };

export type AttachmentPullResult = { applied: number; rejected: number; skipped: number; checkpointAdvanced: boolean };

const TABLE = "transaction_attachments";

async function refreshHasAttachment(db: SQLiteDatabase, transactionId: string) {
  await db.runAsync(
    "UPDATE transactions SET has_attachment = EXISTS (SELECT 1 FROM transaction_attachments WHERE transaction_id = ?) WHERE id = ?",
    [transactionId, transactionId]
  );
}

async function removeLocal(db: SQLiteDatabase, item: AttachmentListItem, transport: AttachmentTransport): Promise<boolean> {
  const local = await db.getFirstAsync<{ file_path: string; transaction_id: string }>(
    "SELECT file_path, transaction_id FROM transaction_attachments WHERE id = ?",
    [item.id]
  );
  if (!local) return false;

  await withApplyingPull(db, async () => {
    await db.runAsync("DELETE FROM transaction_attachments WHERE id = ?", [item.id]);
    await refreshHasAttachment(db, local.transaction_id);
  });
  transport.deleteFile(local.file_path);
  return true;
}

// Dipanggil SETELAH pull data biasa (butuh transaksi induknya sudah ada lokal). Berbeda dari tabel data: tidak ada
// LWW (satu file tidak punya "versi lama vs baru"), cukup unduh sekali kalau belum ada. Checkpoint terpisah.
// Jaringan/unduhan yang gagal menahan checkpoint; induk yang tidak ada pada pull PENUH dilewati permanen (alasan
// sama dengan apply-sync-response: pada pull penuh semua induk yang masih ada pasti sudah ikut ditarik).
export async function runAttachmentPull(
  db: SQLiteDatabase,
  creds: CloudSyncCredentials,
  fetchImpl?: FetchLike,
  transport?: AttachmentTransport
): Promise<AttachmentPullResult> {
  const { attachmentCheckpoint } = await getSyncState(db);
  const fullSnapshot = attachmentCheckpoint === null;
  const query = attachmentCheckpoint ? `?since=${encodeURIComponent(attachmentCheckpoint)}` : "";
  const response = await workerRequest<AttachmentListResponse>(creds, `/attachments${query}`, {}, fetchImpl);

  const result: AttachmentPullResult = { applied: 0, rejected: 0, skipped: 0, checkpointAdvanced: false };
  const resolvedTransport = response.attachments.length > 0 ? (transport ?? (await loadDefaultAttachmentTransport())) : null;

  for (const item of response.attachments) {
    if (!resolvedTransport) break;
    try {
      if (item.deletedAt !== null) {
        if (await removeLocal(db, item, resolvedTransport)) result.applied++;
        await clearRejected(db, "pull", TABLE, item.id);
        continue;
      }

      const alreadyLocal = await db.getFirstAsync("SELECT 1 FROM transaction_attachments WHERE id = ?", [item.id]);
      if (alreadyLocal) continue;

      const parent = await db.getFirstAsync("SELECT 1 FROM transactions WHERE id = ?", [item.transactionId]);
      if (!parent) {
        const reason = `transaksi induk ${item.transactionId} tidak ada di perangkat ini`;
        if (fullSnapshot) {
          result.skipped++;
          await logRejected(db, "pull", TABLE, item.id, `dilewati: ${reason}`);
        } else {
          result.rejected++;
          await logRejected(db, "pull", TABLE, item.id, reason);
        }
        continue;
      }

      // Unduh di luar jendela penanda gema (jaringan lambat tidak boleh menahan antrean push), tulis DB di dalamnya.
      let filePath: string;
      try {
        filePath = await resolvedTransport.download(creds, { id: item.id, contentType: item.contentType });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // 404: barisnya ada di cloud tapi file-nya sudah tidak ada (mis. objek R2 terhapus). Tidak akan pernah berhasil.
        if (/status: 404|HTTP 404/.test(message)) {
          result.skipped++;
          await logRejected(db, "pull", TABLE, item.id, `dilewati: file tidak ada di cloud (${message})`);
          continue;
        }
        throw error;
      }
      await withApplyingPull(db, async () => {
        await db.runAsync("INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES (?, ?, ?)", [
          item.id,
          item.transactionId,
          filePath,
        ]);
        await refreshHasAttachment(db, item.transactionId);
      });
      await clearRejected(db, "pull", TABLE, item.id);
      result.applied++;
    } catch (error) {
      result.rejected++;
      await logRejected(db, "pull", TABLE, item.id, error instanceof Error ? error.message : String(error));
    }
  }

  result.checkpointAdvanced = result.rejected === 0;
  if (result.checkpointAdvanced) await setAttachmentCheckpoint(db, response.checkpoint);
  return result;
}

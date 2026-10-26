import type { SQLiteDatabase } from "expo-sqlite";
import { deleteAttachmentFile } from "./save-attachment-file";

export async function deleteAttachmentById(db: SQLiteDatabase, transactionId: string, attachmentId: string) {
  const row = await db.getFirstAsync<{ file_path: string }>(
    "SELECT file_path FROM transaction_attachments WHERE id = ?",
    [attachmentId]
  );
  if (!row) return;

  await db.runAsync("DELETE FROM transaction_attachments WHERE id = ?", [attachmentId]);
  deleteAttachmentFile(row.file_path);

  const remaining = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM transaction_attachments WHERE transaction_id = ?",
    [transactionId]
  );
  if ((remaining?.count ?? 0) === 0) {
    await db.runAsync("UPDATE transactions SET has_attachment = 0 WHERE id = ?", [transactionId]);
  }
}

import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database";
import type { AddAttachmentInput } from "./use-add-attachment";
import { saveAttachmentFile } from "./save-attachment-file";

export async function saveAttachmentToTransaction(
  db: SQLiteDatabase,
  transactionId: string,
  input: AddAttachmentInput
) {
  const filePath = await saveAttachmentFile(input.uri, input.name);
  const attachmentId = generateId();
  await db.runAsync(
    "INSERT INTO transaction_attachments (id, transaction_id, file_path) VALUES (?, ?, ?)",
    [attachmentId, transactionId, filePath]
  );
  await db.runAsync("UPDATE transactions SET has_attachment = 1 WHERE id = ?", [transactionId]);
}

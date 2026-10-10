import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";

export async function deleteLocalAttachment(id: string): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ file_path: string }[]>(
    "SELECT file_path FROM transaction_attachments WHERE id = $1",
    [id]
  );
  const localFilePath = rows[0]?.file_path;
  if (!localFilePath) return;

  await invoke("delete_attachment_file", { filePath: localFilePath }).catch(() => undefined);
  await db.execute("DELETE FROM transaction_attachments WHERE id = $1", [id]);
}

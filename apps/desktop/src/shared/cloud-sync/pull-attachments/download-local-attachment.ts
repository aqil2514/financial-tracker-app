import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";
import type { AttachmentListItem, CloudSyncCredentials } from "../worker-client";
import { getAttachmentBytes } from "../worker-client";

export async function downloadLocalAttachment(
  creds: CloudSyncCredentials,
  item: AttachmentListItem,
  targetDir: string | null
): Promise<void> {
  const db = await getDb();
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

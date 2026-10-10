import { invoke } from "@tauri-apps/api/core";

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushAttachment } from "../worker-client";
import { inferContentType } from "./infer-content-type";

export async function pushAttachmentRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<{ id: string; transaction_id: string; file_path: string }[]>(
    "SELECT id, transaction_id, file_path FROM transaction_attachments WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  const bytes = await invoke<number[]>("read_attachment_bytes", { filePath: row.file_path });
  return pushAttachment(creds, {
    id: row.id,
    transactionId: row.transaction_id,
    bytes: Uint8Array.from(bytes),
    contentType: inferContentType(row.file_path),
  });
}

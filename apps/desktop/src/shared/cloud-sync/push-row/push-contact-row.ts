import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushContact } from "../worker-client";

export async function pushContactRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<{ id: string; name: string; note: string | null; updated_at: string | null }[]>(
    "SELECT id, name, note, updated_at FROM contacts WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushContact(creds, { id: row.id, name: row.name, note: row.note, updatedAt: row.updated_at ?? undefined });
}

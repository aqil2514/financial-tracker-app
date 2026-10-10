import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushAccountGroup } from "../worker-client";

export async function pushAccountGroupRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<{ id: string; name: string; updated_at: string | null }[]>(
    "SELECT id, name, updated_at FROM account_groups WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushAccountGroup(creds, { id: row.id, name: row.name, updatedAt: row.updated_at ?? undefined });
}

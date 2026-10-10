import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushLabel } from "../worker-client";

export async function pushLabelRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    { id: string; name: string; scope: "transaction_category" | "account"; updated_at: string | null }[]
  >("SELECT id, name, scope, updated_at FROM labels WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) return null;
  return pushLabel(creds, { id: row.id, name: row.name, scope: row.scope, updatedAt: row.updated_at ?? undefined });
}

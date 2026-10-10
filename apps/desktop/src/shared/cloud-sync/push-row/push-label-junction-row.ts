import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, LabelEntityScope, PushUpsertResult } from "../worker-client";
import { pushAttachLabel } from "../worker-client";

const JUNCTION: Record<
  "transaction_labels" | "category_labels" | "account_labels",
  { column: string; scope: LabelEntityScope }
> = {
  transaction_labels: { column: "transaction_id", scope: "transactions" },
  category_labels: { column: "category_id", scope: "categories" },
  account_labels: { column: "account_id", scope: "accounts" },
};

export async function pushLabelJunctionRow(
  creds: CloudSyncCredentials,
  table: "transaction_labels" | "category_labels" | "account_labels",
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const { column, scope } = JUNCTION[table];
  const rows = await db.select<{ id: string; entity_id: string; label_id: string; updated_at: string | null }[]>(
    `SELECT id, ${column} as entity_id, label_id, updated_at FROM ${table} WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushAttachLabel(creds, scope, row.entity_id, {
    id: row.id,
    labelId: row.label_id,
    updatedAt: row.updated_at ?? undefined,
  });
}

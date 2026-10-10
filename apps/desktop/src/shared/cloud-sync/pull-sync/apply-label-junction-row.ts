import type Database from "@tauri-apps/plugin-sql";

import { upsertLabelJunction } from "./upsert-label-junction";
import { wins } from "./wins";

export async function applyLabelJunctionRow(
  db: Database,
  table: "transaction_labels" | "category_labels" | "account_labels",
  entityColumn: "transaction_id" | "category_id" | "account_id",
  row: { id: string; entityId: string; labelId: string; updatedAt: string | null; deletedAt: string | null }
): Promise<void> {
  const rows = await db.select<{ updated_at: string | null }[]>(
    `SELECT updated_at FROM ${table} WHERE ${entityColumn} = $1 AND label_id = $2`,
    [row.entityId, row.labelId]
  );
  if (!wins(row.updatedAt, rows[0]?.updated_at ?? null)) return;

  if (row.deletedAt !== null) {
    await db.execute(`DELETE FROM ${table} WHERE ${entityColumn} = $1 AND label_id = $2`, [
      row.entityId,
      row.labelId,
    ]);
    return;
  }

  await upsertLabelJunction(db, table, entityColumn, row);
}

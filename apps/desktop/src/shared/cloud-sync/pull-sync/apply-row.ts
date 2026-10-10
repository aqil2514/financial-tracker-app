import type Database from "@tauri-apps/plugin-sql";

import { getLocalUpdatedAt } from "./get-local-updated-at";
import type { SyncRow } from "./types";
import { wins } from "./wins";

export async function applyRow<TRow extends SyncRow>(
  db: Database,
  table: string,
  row: TRow,
  upsert: (db: Database, row: TRow) => Promise<void>
): Promise<void> {
  const localUpdatedAt = await getLocalUpdatedAt(db, table, row.id);
  if (!wins(row.updatedAt, localUpdatedAt)) return;

  if (row.deletedAt !== null) {
    await db.execute(`DELETE FROM ${table} WHERE id = $1`, [row.id]);
    return;
  }

  await upsert(db, row);
}

import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertContact(db: Database, row: SyncResponse["contacts"][number]) {
  await db.execute(
    `INSERT INTO contacts (id, name, note, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, note = excluded.note, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.note, row.updatedAt]
  );
}

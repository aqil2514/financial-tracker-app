import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertLabel(db: Database, row: SyncResponse["labels"][number]) {
  await db.execute(
    `INSERT INTO labels (id, name, scope, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, scope = excluded.scope,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.scope, row.updatedAt]
  );
}

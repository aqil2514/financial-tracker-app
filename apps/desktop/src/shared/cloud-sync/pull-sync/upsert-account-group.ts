import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertAccountGroup(db: Database, row: SyncResponse["accountGroups"][number]) {
  await db.execute(
    `INSERT INTO account_groups (id, name, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.updatedAt]
  );
}

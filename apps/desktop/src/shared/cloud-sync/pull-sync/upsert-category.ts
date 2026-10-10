import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertCategory(db: Database, row: SyncResponse["categories"][number]) {
  await db.execute(
    `INSERT INTO categories (id, name, icon, type, parent_id, is_active, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, type = excluded.type,
       parent_id = excluded.parent_id, is_active = excluded.is_active, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.name, row.icon, row.type, row.parentId, Number(row.isActive), row.updatedAt]
  );
}

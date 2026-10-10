import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertAccount(db: Database, row: SyncResponse["accounts"][number]) {
  await db.execute(
    `INSERT INTO accounts (id, name, icon, color, initial_balance, group_id, description, is_active, account_type, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color,
       initial_balance = excluded.initial_balance, group_id = excluded.group_id, description = excluded.description,
       is_active = excluded.is_active, account_type = excluded.account_type, updated_at = excluded.updated_at,
       deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.name,
      row.icon,
      row.color,
      row.initialBalance,
      row.groupId,
      row.description,
      Number(row.isActive),
      row.accountType,
      row.updatedAt,
    ]
  );
}

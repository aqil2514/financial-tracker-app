import type Database from "@tauri-apps/plugin-sql";

export async function upsertLabelJunction(
  db: Database,
  table: "transaction_labels" | "category_labels" | "account_labels",
  entityColumn: "transaction_id" | "category_id" | "account_id",
  row: { id: string; entityId: string; labelId: string; updatedAt: string | null }
) {
  await db.execute(
    `INSERT INTO ${table} (id, ${entityColumn}, label_id, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, NULL, 'mcp')
     ON CONFLICT(${entityColumn}, label_id) DO UPDATE SET
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.entityId, row.labelId, row.updatedAt]
  );
}

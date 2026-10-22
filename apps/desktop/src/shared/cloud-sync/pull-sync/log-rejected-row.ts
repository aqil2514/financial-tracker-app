import type Database from "@tauri-apps/plugin-sql";

export async function logRejectedRow(db: Database, table: string, rowId: string, error: unknown): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  await db.execute(
    `INSERT INTO cloud_sync_rejected_log (table_name, row_id, reason)
     VALUES ($1, $2, $3)
     ON CONFLICT(table_name, row_id) DO UPDATE SET reason = excluded.reason, rejected_at = datetime('now')`,
    [table, rowId, reason]
  );
}

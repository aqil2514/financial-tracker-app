import type { SQLiteDatabase } from "expo-sqlite";

type Direction = "push" | "pull";

export async function logRejected(db: SQLiteDatabase, direction: Direction, table: string, rowId: string, reason: string) {
  await db.runAsync(
    `INSERT INTO cloud_sync_rejected_log (table_name, row_id, direction, reason) VALUES (?, ?, ?, ?)
     ON CONFLICT (table_name, row_id, direction) DO UPDATE SET reason = excluded.reason, rejected_at = datetime('now')`,
    [table, rowId, direction, reason]
  );
}

export async function clearRejected(db: SQLiteDatabase, direction: Direction, table: string, rowId: string) {
  await db.runAsync("DELETE FROM cloud_sync_rejected_log WHERE table_name = ? AND row_id = ? AND direction = ?", [
    table,
    rowId,
    direction,
  ]);
}

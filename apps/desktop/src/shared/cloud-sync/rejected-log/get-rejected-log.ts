import { getDb } from "@/lib/db";

export type RejectedLogEntry = {
  id: number;
  tableName: string;
  rowId: string;
  reason: string;
  rejectedAt: string;
};

export async function getRejectedLog(): Promise<RejectedLogEntry[]> {
  const db = await getDb();
  const rows = await db.select<
    { id: number; table_name: string; row_id: string; reason: string; rejected_at: string }[]
  >("SELECT id, table_name, row_id, reason, rejected_at FROM cloud_sync_rejected_log ORDER BY rejected_at DESC");
  return rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    rowId: row.row_id,
    reason: row.reason,
    rejectedAt: row.rejected_at,
  }));
}

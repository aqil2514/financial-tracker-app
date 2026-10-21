import { getDb } from "@/lib/db";
import type { QueueableTable } from "../push-queue";

export async function logRejectedPush(table: QueueableTable, id: string, reason: string) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO cloud_sync_rejected_log (table_name, row_id, reason) VALUES ($1, $2, $3)
     ON CONFLICT(table_name, row_id) DO UPDATE SET reason = $3, rejected_at = datetime('now')`,
    [table, id, reason]
  );
}

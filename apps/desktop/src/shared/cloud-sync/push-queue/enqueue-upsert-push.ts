import { getDb } from "@/lib/db";
import type { QueueableTable } from "./types";

export async function enqueueUpsertPush(table: QueueableTable, id: string) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO cloud_sync_queue (table_name, row_id, op, payload) VALUES ($1, $2, 'upsert', NULL)
     ON CONFLICT(table_name, row_id) DO UPDATE SET op = 'upsert', payload = NULL, attempts = 0, last_error = NULL`,
    [table, id]
  );
}

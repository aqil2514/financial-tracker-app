import { getDb } from "@/lib/db";
import type { DeleteCloudPayload } from "../worker-client";
import type { DeletableTable } from "./types";

export async function enqueueDeletePush(
  table: DeletableTable,
  id: string,
  payload: Omit<Extract<DeleteCloudPayload, { table: typeof table }>, "table">
) {
  const db = await getDb();
  await db.execute(
    `INSERT INTO cloud_sync_queue (table_name, row_id, op, payload) VALUES ($1, $2, 'delete', $3)
     ON CONFLICT(table_name, row_id) DO UPDATE SET op = 'delete', payload = excluded.payload, attempts = 0, last_error = NULL`,
    [table, id, JSON.stringify(payload ?? {})]
  );
}

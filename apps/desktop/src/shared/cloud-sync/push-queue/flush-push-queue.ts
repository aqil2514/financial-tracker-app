import { getDb } from "@/lib/db";
import type { CloudSyncCredentials } from "../worker-client";
import { deleteCloudRow } from "../worker-client";
import { pushRowPayload } from "../push-row";
import { markAttemptFailed } from "./mark-attempt-failed";
import { removeFromQueue } from "./remove-from-queue";
import type { DeletableTable, QueueableTable } from "./types";

export async function flushPushQueue(creds: CloudSyncCredentials): Promise<void> {
  const db = await getDb();
  const entries = await db.select<
    { id: number; table_name: QueueableTable; row_id: string; op: "upsert" | "delete"; payload: string | null }[]
  >("SELECT id, table_name, row_id, op, payload FROM cloud_sync_queue ORDER BY id ASC");

  for (const entry of entries) {
    try {
      if (entry.op === "delete") {
        const payload = entry.payload ? JSON.parse(entry.payload) : {};
        await deleteCloudRow(creds, entry.table_name as DeletableTable, entry.row_id, payload);
      } else {
        const result = await pushRowPayload(creds, entry.table_name, entry.row_id);
        if (result?.status === "rejected") {
          await markAttemptFailed(entry.id, `rejected: ${result.reason}`);
          continue;
        }
      }
      await removeFromQueue(entry.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markAttemptFailed(entry.id, message);
    }
  }
}

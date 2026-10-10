import { getDb } from "@/lib/db";

export async function markAttemptFailed(queueId: number, error: string) {
  const db = await getDb();
  await db.execute("UPDATE cloud_sync_queue SET attempts = attempts + 1, last_error = $1 WHERE id = $2", [
    error,
    queueId,
  ]);
}

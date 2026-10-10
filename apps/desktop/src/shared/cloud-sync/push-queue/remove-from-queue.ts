import { getDb } from "@/lib/db";

export async function removeFromQueue(queueId: number) {
  const db = await getDb();
  await db.execute("DELETE FROM cloud_sync_queue WHERE id = $1", [queueId]);
}

import { getDb } from "@/lib/db";
import { pushOnWrite } from "../push-on-write";

export async function pushRetailkuSyncedTransactions(sourceRefs: string[]): Promise<void> {
  if (sourceRefs.length === 0) return;
  try {
    const db = await getDb();
    const placeholders = sourceRefs.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await db.select<{ id: string }[]>(
      `SELECT id FROM transactions WHERE source = 'retailku_sync' AND source_ref IN (${placeholders})`,
      sourceRefs
    );
    for (const row of rows) await pushOnWrite("transactions", row.id);
  } catch {
    // best-effort, lihat README.md
  }
}

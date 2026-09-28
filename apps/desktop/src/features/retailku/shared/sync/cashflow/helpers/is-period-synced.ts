import type { Db } from "../types";

export async function isPeriodSynced(db: Db, date: string, retailkuAccountId: string): Promise<boolean> {
  const prefix = `${date}:${retailkuAccountId}`;
  const rows = await db.select<{ found: number }[]>(
    "SELECT 1 AS found FROM transactions WHERE source = 'retailku_sync' AND (source_ref = $1 OR source_ref LIKE $1 || ':%') LIMIT 1",
    [prefix]
  );
  return rows.length > 0;
}

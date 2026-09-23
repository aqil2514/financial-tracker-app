import type { Db } from "../types";

export async function loadAccountMapping(db: Db): Promise<Map<string, number>> {
  const rows = await db.select<{ retailku_account_id: string; local_account_id: number }[]>(
    "SELECT retailku_account_id, local_account_id FROM retailku_account_mapping"
  );
  return new Map(rows.map((row) => [row.retailku_account_id, row.local_account_id]));
}

import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertForexPurchase(db: Database, row: SyncResponse["forexPurchases"][number]) {
  await db.execute(
    `INSERT INTO forex_purchases (id, account_id, transaction_id, unit, rate, date, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, transaction_id = excluded.transaction_id,
       unit = excluded.unit, rate = excluded.rate, date = excluded.date,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.id, row.accountId, row.transactionId, row.unit, row.rate, row.date, row.updatedAt]
  );
}

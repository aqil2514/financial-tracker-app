import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertForexAccount(db: Database, row: SyncResponse["forexAccounts"][number]) {
  await db.execute(
    `INSERT INTO forex_accounts (account_id, country, currency, current_rate, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, NULL, 'mcp')
     ON CONFLICT(account_id) DO UPDATE SET country = excluded.country, currency = excluded.currency,
       current_rate = excluded.current_rate, updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.accountId, row.country, row.currency, row.currentRate, row.updatedAt]
  );
}

import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertInvestmentAccount(db: Database, row: SyncResponse["investmentAccounts"][number]) {
  await db.execute(
    `INSERT INTO investment_accounts (account_id, unit_label, current_market_value, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, NULL, 'mcp')
     ON CONFLICT(account_id) DO UPDATE SET unit_label = excluded.unit_label,
       current_market_value = excluded.current_market_value,
       updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [row.accountId, row.unitLabel, row.currentMarketValue, row.updatedAt]
  );
}

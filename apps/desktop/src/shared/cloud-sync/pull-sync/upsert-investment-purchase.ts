import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertInvestmentPurchase(db: Database, row: SyncResponse["investmentPurchases"][number]) {
  await db.execute(
    `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, transaction_id = excluded.transaction_id,
       unit = excluded.unit, price_per_unit = excluded.price_per_unit, date = excluded.date,
       status = excluded.status, updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.accountId,
      row.transactionId,
      row.unit,
      row.pricePerUnit,
      row.date,
      row.status,
      row.updatedAt,
    ]
  );
}

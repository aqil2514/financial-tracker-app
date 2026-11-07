import type Database from "@tauri-apps/plugin-sql";

import type { SyncResponse } from "./types";

export async function upsertForexSale(db: Database, row: SyncResponse["forexSales"][number]) {
  await db.execute(
    `INSERT INTO forex_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, rate,
       average_cost_per_unit, realized_pl, date, updated_at, deleted_at, sync_source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, 'mcp')
     ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id, transaction_id = excluded.transaction_id,
       adjustment_transaction_id = excluded.adjustment_transaction_id, unit = excluded.unit, rate = excluded.rate,
       average_cost_per_unit = excluded.average_cost_per_unit, realized_pl = excluded.realized_pl,
       date = excluded.date, updated_at = excluded.updated_at, deleted_at = NULL, sync_source = 'mcp'`,
    [
      row.id,
      row.accountId,
      row.transactionId,
      row.adjustmentTransactionId,
      row.unit,
      row.rate,
      row.averageCostPerUnit,
      row.realizedPl,
      row.date,
      row.updatedAt,
    ]
  );
}

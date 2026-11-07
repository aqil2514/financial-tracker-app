import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushForexSale } from "../worker-client";

export async function pushForexSaleRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      transaction_id: string | null;
      adjustment_transaction_id: string | null;
      unit: number;
      rate: number;
      average_cost_per_unit: number;
      realized_pl: number;
      date: string;
      updated_at: string | null;
    }[]
  >(
    `SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, rate, average_cost_per_unit,
            realized_pl, date, updated_at
     FROM forex_sales WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  if (!row.transaction_id) return null;
  return pushForexSale(creds, {
    id: row.id,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    adjustmentTransactionId: row.adjustment_transaction_id,
    unit: row.unit,
    rate: row.rate,
    averageCostPerUnit: row.average_cost_per_unit,
    realizedPl: row.realized_pl,
    date: row.date,
    updatedAt: row.updated_at ?? undefined,
  });
}

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushInvestmentSale } from "../worker-client";

export async function pushInvestmentSaleRow(
  creds: CloudSyncCredentials,
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      transaction_id: string | null;
      adjustment_transaction_id: string | null;
      unit: number;
      price_per_unit: number;
      average_cost_per_unit: number | null;
      realized_pl: number | null;
      date: string;
      status: "pending" | "settled";
      updated_at: string | null;
    }[]
  >(
    "SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, updated_at FROM investment_sales WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushInvestmentSale(creds, {
    id: row.id,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    adjustmentTransactionId: row.adjustment_transaction_id,
    unit: row.unit,
    pricePerUnit: row.price_per_unit,
    averageCostPerUnit: row.average_cost_per_unit,
    realizedPl: row.realized_pl,
    date: row.date,
    status: row.status,
    updatedAt: row.updated_at ?? undefined,
  });
}

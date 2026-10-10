import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushInvestmentPurchase } from "../worker-client";

export async function pushInvestmentPurchaseRow(
  creds: CloudSyncCredentials,
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      transaction_id: string | null;
      unit: number | null;
      price_per_unit: number | null;
      date: string;
      status: "pending" | "settled";
      updated_at: string | null;
    }[]
  >(
    "SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, updated_at FROM investment_purchases WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  // transaction_id null -> skip, lihat README.md
  if (!row.transaction_id) return null;
  return pushInvestmentPurchase(creds, {
    id: row.id,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    unit: row.unit,
    pricePerUnit: row.price_per_unit,
    date: row.date,
    status: row.status,
    updatedAt: row.updated_at ?? undefined,
  });
}

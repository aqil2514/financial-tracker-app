import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushForexPurchase } from "../worker-client";

export async function pushForexPurchaseRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      transaction_id: string | null;
      unit: number;
      rate: number;
      date: string;
      updated_at: string | null;
    }[]
  >("SELECT id, account_id, transaction_id, unit, rate, date, updated_at FROM forex_purchases WHERE id = $1", [id]);
  const row = rows[0];
  if (!row) return null;
  // transaction_id null berarti transaksi asalnya sudah terhapus: tidak ada yang bisa di-push.
  if (!row.transaction_id) return null;
  return pushForexPurchase(creds, {
    id: row.id,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    unit: row.unit,
    rate: row.rate,
    date: row.date,
    updatedAt: row.updated_at ?? undefined,
  });
}

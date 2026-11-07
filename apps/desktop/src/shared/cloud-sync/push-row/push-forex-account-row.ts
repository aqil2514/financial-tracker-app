import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushForexAccount } from "../worker-client";

export async function pushForexAccountRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    { account_id: string; country: string; currency: string; current_rate: number; updated_at: string | null }[]
  >("SELECT account_id, country, currency, current_rate, updated_at FROM forex_accounts WHERE account_id = $1", [id]);
  const row = rows[0];
  if (!row) return null;
  return pushForexAccount(creds, {
    accountId: row.account_id,
    country: row.country,
    currency: row.currency,
    currentRate: row.current_rate,
    updatedAt: row.updated_at ?? undefined,
  });
}

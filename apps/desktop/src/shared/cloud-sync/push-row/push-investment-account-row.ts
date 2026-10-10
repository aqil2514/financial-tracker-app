import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushInvestmentAccount } from "../worker-client";

export async function pushInvestmentAccountRow(
  creds: CloudSyncCredentials,
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    { account_id: string; unit_label: string; current_market_value: number; updated_at: string | null }[]
  >(
    "SELECT account_id, unit_label, current_market_value, updated_at FROM investment_accounts WHERE account_id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushInvestmentAccount(creds, {
    accountId: row.account_id,
    unitLabel: row.unit_label,
    currentMarketValue: row.current_market_value,
    updatedAt: row.updated_at ?? undefined,
  });
}

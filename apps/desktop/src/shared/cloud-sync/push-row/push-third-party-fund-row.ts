import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushThirdPartyFund } from "../worker-client";

export async function pushThirdPartyFundRow(
  creds: CloudSyncCredentials,
  id: string
): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      account_id: string;
      contact_id: string;
      transaction_id: string | null;
      direction: "in" | "out";
      amount: number;
      date: string;
      note: string | null;
      updated_at: string | null;
    }[]
  >(
    "SELECT id, account_id, contact_id, transaction_id, direction, amount, date, note, updated_at FROM third_party_funds WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushThirdPartyFund(creds, {
    id: row.id,
    accountId: row.account_id,
    contactId: row.contact_id,
    transactionId: row.transaction_id,
    direction: row.direction,
    amount: row.amount,
    date: row.date,
    note: row.note,
    updatedAt: row.updated_at ?? undefined,
  });
}

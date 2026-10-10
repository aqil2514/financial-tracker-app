import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushTransaction } from "../worker-client";

export async function pushTransactionRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      type: "income" | "expense" | "transfer";
      amount: number;
      category_id: string | null;
      account_id: string | null;
      transfer_account_id: string | null;
      note: string;
      description: string | null;
      date: string;
      contact_id: string | null;
      source: "manual" | "retailku_sync";
      source_ref: string | null;
      updated_at: string | null;
    }[]
  >(
    "SELECT id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id, source, source_ref, updated_at FROM transactions WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushTransaction(creds, {
    id: row.id,
    type: row.type,
    amount: row.amount,
    categoryId: row.category_id,
    accountId: row.account_id,
    transferAccountId: row.transfer_account_id,
    note: row.note,
    description: row.description,
    date: row.date,
    contactId: row.contact_id,
    source: row.source,
    sourceRef: row.source_ref,
    updatedAt: row.updated_at ?? undefined,
  });
}

import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushDebt } from "../worker-client";

export async function pushDebtRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      type: "receivable" | "payable";
      contact_id: string | null;
      amount: number;
      account_id: string | null;
      transaction_id: string | null;
      status: "ongoing" | "paid" | "written_off";
      note: string | null;
      date: string;
      source: "manual" | "retailku_sync";
      source_ref: string | null;
      updated_at: string | null;
    }[]
  >(
    "SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date, source, source_ref, updated_at FROM debts WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  // transaction_id null -> skip, lihat README.md
  if (!row.transaction_id) return null;
  return pushDebt(creds, {
    id: row.id,
    type: row.type,
    contactId: row.contact_id,
    amount: row.amount,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    status: row.status,
    note: row.note,
    date: row.date,
    source: row.source,
    sourceRef: row.source_ref,
    updatedAt: row.updated_at ?? undefined,
  });
}

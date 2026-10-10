import { getDb } from "@/lib/db";
import type { CloudSyncCredentials, PushUpsertResult } from "../worker-client";
import { pushDebtPayment } from "../worker-client";

export async function pushDebtPaymentRow(creds: CloudSyncCredentials, id: string): Promise<PushUpsertResult | null> {
  const db = await getDb();
  const rows = await db.select<
    {
      id: string;
      debt_id: string;
      amount: number;
      account_id: string | null;
      transaction_id: string | null;
      note: string | null;
      date: string;
      source: "manual" | "retailku_sync";
      source_ref: string | null;
      updated_at: string | null;
    }[]
  >(
    "SELECT id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, updated_at FROM debt_payments WHERE id = $1",
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return pushDebtPayment(creds, {
    id: row.id,
    debtId: row.debt_id,
    amount: row.amount,
    accountId: row.account_id,
    transactionId: row.transaction_id,
    note: row.note,
    date: row.date,
    source: row.source,
    sourceRef: row.source_ref,
    updatedAt: row.updated_at ?? undefined,
  });
}

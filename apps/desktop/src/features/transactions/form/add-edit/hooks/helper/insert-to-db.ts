import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { isEmptyDoc } from "@/components/rich-text";
import type { TransactionFormOutput } from "../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type InsertTransactionInput = {
  db: Db;
  contactId: string | null;
  amount: number;
  transferAccountId: string | null;
  values: TransactionFormOutput;
};

export async function insertTransactionToDb({
  db,
  contactId,
  amount,
  transferAccountId,
  values,
}: InsertTransactionInput): Promise<string> {
  const transactionId = newId();

  await db.execute(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, description, date, contact_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      transactionId,
      values.type,
      amount,
      values.type === "transfer" || !values.category_id ? null : values.category_id,
      values.account_id,
      transferAccountId,
      values.note,
      isEmptyDoc(values.description) ? null : JSON.stringify(values.description),
      values.date,
      contactId,
    ]
  );

  return transactionId;
}

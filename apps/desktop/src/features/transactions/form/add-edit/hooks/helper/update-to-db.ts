import { getDb } from "@/lib/db";
import { isEmptyDoc } from "@/components/rich-text";
import type { TransactionFormOutput } from "../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateTransactionInput = {
  db: Db;
  transactionId: string;
  contactId: string | null;
  amount: number;
  transferAccountId: string | null;
  values: TransactionFormOutput;
};

export async function updateTransactionToDb({
  db,
  transactionId,
  contactId,
  amount,
  transferAccountId,
  values,
}: UpdateTransactionInput): Promise<string> {
  await db.execute(
    `UPDATE transactions
     SET type = $1, amount = $2, category_id = $3, account_id = $4, transfer_account_id = $5, note = $6, description = $7, date = $8, contact_id = $9
     WHERE id = $10`,
    [
      values.type,
      amount,
      values.type === "transfer" || !values.category_id ? null : values.category_id,
      values.account_id,
      transferAccountId,
      values.note,
      isEmptyDoc(values.description) ? null : JSON.stringify(values.description),
      values.date,
      contactId,
      transactionId,
    ]
  );

  return transactionId;
}

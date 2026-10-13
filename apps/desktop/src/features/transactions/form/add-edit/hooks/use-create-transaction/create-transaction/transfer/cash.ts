import { getDb } from "@/lib/db";
import { insertTransactionToDb, applyLabelsAndPush } from "../../../helper";
import type { TransactionFormOutput } from "../../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateCashToCashTransferInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
  accountId: string;
  transferAccountId: string | null;
};

export async function createCashToCashTransfer({
  db,
  contactId,
  values,
  transferAccountId,
}: CreateCashToCashTransferInput): Promise<string> {
  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount: values.amount,
    transferAccountId,
    values,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  return transactionId;
}

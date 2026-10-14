import { getDb, type Transaction } from "@/lib/db";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateCashToCashTransferInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  accountId: string;
  transferAccountId: string | null;
};

export async function updateCashToCashTransfer({
  db,
  contactId,
  transaction,
  values,
  transferAccountId,
}: UpdateCashToCashTransferInput): Promise<string> {
  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount: values.amount,
    transferAccountId,
    values,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  return transactionId;
}

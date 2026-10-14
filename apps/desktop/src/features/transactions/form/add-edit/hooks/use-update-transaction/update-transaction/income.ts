import { getDb, type Transaction } from "@/lib/db";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateIncomeTransactionInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
};

export async function updateIncomeTransaction({
  db,
  contactId,
  transaction,
  values,
}: UpdateIncomeTransactionInput): Promise<string> {
  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  return transactionId;
}

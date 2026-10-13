import { getDb } from "@/lib/db";
import { insertTransactionToDb, applyLabelsAndPush } from "../../helper";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateIncomeTransactionInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createIncomeTransaction({
  db,
  contactId,
  values,
}: CreateIncomeTransactionInput): Promise<string> {
  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  return transactionId;
}

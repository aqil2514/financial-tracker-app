import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { insertTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateDirectDebtExpenseInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createDirectDebtExpense({
  db,
  contactId,
  values,
}: CreateDirectDebtExpenseInput): Promise<string> {
  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  const debtId = newId();
  await db.execute(
    `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date, note)
     VALUES ($1, 'payable', $2, $3, $4, $5, $6, $7)`,
    [debtId, contactId, values.amount, values.account_id, transactionId, values.date, values.note]
  );

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  void pushOnWrite("debts", debtId);

  return transactionId;
}

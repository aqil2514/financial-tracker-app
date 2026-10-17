import { getDb } from "@/lib/db";
import { insertTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applyDirectDebtTransaction } from "@/shared/debts/apply-debt-transaction";
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

  const touchedDebtRows = await applyDirectDebtTransaction({
    db,
    transactionId,
    type: "expense",
    accountId: values.account_id,
    contactId,
    amount: values.amount,
    date: values.date,
    settleDebtIds: values.settle_debt_ids,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
  for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);

  return transactionId;
}

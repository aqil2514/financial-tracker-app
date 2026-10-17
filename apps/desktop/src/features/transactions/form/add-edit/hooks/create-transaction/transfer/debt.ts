import { getDb } from "@/lib/db";
import { applyDebtTransaction } from "@/shared/debts/apply-debt-transaction";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { insertTransactionToDb, applyLabelsAndPush } from "../../helper";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateDebtTransferInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
  accountId: string;
  transferAccountId: string;
};

export async function createDebtTransfer({
  db,
  contactId,
  values,
  accountId,
  transferAccountId,
}: CreateDebtTransferInput): Promise<string> {
  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount: values.amount,
    transferAccountId,
    values,
  });

  const touchedDebtRows = await applyDebtTransaction({
    db,
    transactionId,
    type: values.type,
    accountId,
    transferAccountId,
    contactId,
    amount: values.amount,
    date: values.date,
    settleDebtIds: values.type === "transfer" ? values.settle_debt_ids : [],
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
  for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);

  return transactionId;
}

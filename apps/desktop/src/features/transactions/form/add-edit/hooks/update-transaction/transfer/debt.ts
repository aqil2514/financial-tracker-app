import { getDb, type Transaction } from "@/lib/db";
import { applyDebtTransactionEdit } from "@/shared/debts/apply-debt-transaction";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateDebtTransferInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  accountId: string;
  transferAccountId: string;
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export async function updateDebtTransfer({
  db,
  contactId,
  transaction,
  values,
  accountId,
  transferAccountId,
  status,
  dangerousFieldsChanged,
}: UpdateDebtTransferInput): Promise<string> {
  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount: values.amount,
    transferAccountId,
    values,
  });

  const touchedDebtRows = await applyDebtTransactionEdit({
    db,
    transactionId,
    type: values.type,
    accountId,
    transferAccountId,
    contactId,
    amount: values.amount,
    date: values.date,
    settleDebtIds: values.type === "transfer" ? values.settle_debt_ids : [],
    status,
    dangerousFieldsChanged,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
  for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);
  for (const debtId of touchedDebtRows.deletedDebtIds) void pushDeleteOnWrite("debts", debtId, {});
  for (const debtPaymentId of touchedDebtRows.deletedDebtPaymentIds)
    void pushDeleteOnWrite("debt_payments", debtPaymentId, {});

  return transactionId;
}

import { getDb, type Transaction } from "@/lib/db";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applyDirectDebtTransactionEdit } from "@/shared/debts/apply-debt-transaction";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateDirectDebtExpenseInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export async function updateDirectDebtExpense({
  db,
  contactId,
  transaction,
  values,
  status,
  dangerousFieldsChanged,
}: UpdateDirectDebtExpenseInput): Promise<string> {
  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  const touchedDebtRows = await applyDirectDebtTransactionEdit({
    db,
    transactionId,
    type: "expense",
    accountId: values.account_id,
    contactId,
    amount: values.amount,
    date: values.date,
    settleDebtIds: values.settle_debt_ids,
    status,
    dangerousFieldsChanged,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  for (const debtId of touchedDebtRows.debtIds) void pushOnWrite("debts", debtId);
  for (const debtPaymentId of touchedDebtRows.debtPaymentIds) void pushOnWrite("debt_payments", debtPaymentId);
  for (const deletedDebtId of touchedDebtRows.deletedDebtIds) void pushDeleteOnWrite("debts", deletedDebtId, {});
  for (const deletedDebtPaymentId of touchedDebtRows.deletedDebtPaymentIds)
    void pushDeleteOnWrite("debt_payments", deletedDebtPaymentId, {});

  return transactionId;
}

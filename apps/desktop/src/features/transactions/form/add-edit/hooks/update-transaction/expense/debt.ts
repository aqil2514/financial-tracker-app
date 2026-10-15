import { getDb, type Transaction } from "@/lib/db";
import { newId } from "@/lib/id";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { DebtEditBlockedError } from "@/shared/debts/apply-debt-transaction";
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
  if (status.role === "payment") {
    throw new Error("Transaksi ini tercatat sebagai cicilan utang/piutang, bukan piutang/utang direct.");
  }

  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  let newDebtId: string | null = null;
  let deletedDebtId: string | null = null;

  if (status.role === "none") {
    newDebtId = newId();
    await db.execute(
      `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date, note)
       VALUES ($1, 'payable', $2, $3, $4, $5, $6, $7)`,
      [newDebtId, contactId, values.amount, values.account_id, transactionId, values.date, values.note]
    );
  } else if (!dangerousFieldsChanged) {
    await db.execute("UPDATE debts SET date = $1, note = $2 WHERE id = $3", [
      values.date,
      values.note,
      status.debtId,
    ]);
    newDebtId = status.debtId;
  } else if (status.hasPayments) {
    throw new DebtEditBlockedError();
  } else {
    deletedDebtId = status.debtId;
    await db.execute("DELETE FROM debts WHERE id = $1", [status.debtId]);
    newDebtId = newId();
    await db.execute(
      `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date, note)
       VALUES ($1, 'payable', $2, $3, $4, $5, $6, $7)`,
      [newDebtId, contactId, values.amount, values.account_id, transactionId, values.date, values.note]
    );
  }

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  if (newDebtId != null) void pushOnWrite("debts", newDebtId);
  if (deletedDebtId != null) void pushDeleteOnWrite("debts", deletedDebtId, {});

  return transactionId;
}

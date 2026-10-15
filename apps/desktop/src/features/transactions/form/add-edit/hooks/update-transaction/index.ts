import { getDb, type Transaction } from "@/lib/db";
import { resolveContactId } from "@/shared/contacts/resolve-contact";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import type { TransactionFormOutput } from "../../schema";
import { updateIncomeTransaction } from "./income";
import { updateExpenseTransaction } from "./expense";
import { updateTransferTransaction } from "./transfer";

export async function updateTransaction(
  transaction: Transaction,
  values: TransactionFormOutput,
  status: TransactionDebtStatus
): Promise<string> {
  const contactId = await resolveContactId(values.contact_name);
  const db = await getDb();

  const transferAccountId = values.type === "transfer" ? values.transfer_account_id : null;
  const dangerousFieldsChanged =
    values.type !== transaction.type ||
    values.account_id !== transaction.account_id ||
    transferAccountId !== transaction.transfer_account_id ||
    values.amount !== transaction.amount ||
    contactId !== transaction.contact_id;

  if (values.type === "income") {
    return updateIncomeTransaction({ db, contactId, transaction, values, status, dangerousFieldsChanged });
  }
  if (values.type === "expense") {
    return updateExpenseTransaction({ db, contactId, transaction, values, status, dangerousFieldsChanged });
  }

  return updateTransferTransaction({
    db,
    contactId,
    transaction,
    values,
    status,
    dangerousFieldsChanged,
  });
}

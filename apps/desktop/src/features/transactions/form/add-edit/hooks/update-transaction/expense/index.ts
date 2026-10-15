import { getDb, type Transaction } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import type { TransactionFormOutput } from "../../../schema";
import { updateCashExpense } from "./cash";
import { updateDirectDebtExpense } from "./debt";
import { updateDirectInvestmentWriteOff } from "./investment";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateExpenseTransactionInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export async function updateExpenseTransaction({
  db,
  contactId,
  transaction,
  values,
  status,
  dangerousFieldsChanged,
}: UpdateExpenseTransactionInput): Promise<string> {
  const accountType = await getAccountType(db, values.account_id);

  if (accountType === "debt") {
    return updateDirectDebtExpense({ db, contactId, transaction, values, status, dangerousFieldsChanged });
  }
  if (accountType === "investment") {
    return updateDirectInvestmentWriteOff({ db, contactId, transaction, values });
  }

  return updateCashExpense({ db, contactId, transaction, values });
}

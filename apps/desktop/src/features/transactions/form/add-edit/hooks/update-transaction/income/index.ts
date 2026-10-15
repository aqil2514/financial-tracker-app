import { getDb, type Transaction } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import type { TransactionFormOutput } from "../../../schema";
import { updateCashIncome } from "./cash";
import { updateDirectDebtIncome } from "./debt";
import { updateDirectInvestmentPurchase } from "./investment";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateIncomeTransactionInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export async function updateIncomeTransaction({
  db,
  contactId,
  transaction,
  values,
  status,
  dangerousFieldsChanged,
}: UpdateIncomeTransactionInput): Promise<string> {
  const accountType = await getAccountType(db, values.account_id);

  if (accountType === "debt") {
    return updateDirectDebtIncome({ db, contactId, transaction, values, status, dangerousFieldsChanged });
  }
  if (accountType === "investment") {
    return updateDirectInvestmentPurchase({ db, contactId, transaction, values });
  }

  return updateCashIncome({ db, contactId, transaction, values });
}

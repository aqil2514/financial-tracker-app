import { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import type { TransactionFormOutput } from "../../../schema";
import { createCashExpense } from "./cash";
import { createDirectDebtExpense } from "./debt";
import { createDirectInvestmentWriteOff } from "./investment";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateExpenseTransactionInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createExpenseTransaction({
  db,
  contactId,
  values,
}: CreateExpenseTransactionInput): Promise<string> {
  const accountType = await getAccountType(db, values.account_id);

  if (accountType === "debt") {
    return createDirectDebtExpense({ db, contactId, values });
  }
  if (accountType === "investment") {
    return createDirectInvestmentWriteOff({ db, contactId, values });
  }

  return createCashExpense({ db, contactId, values });
}

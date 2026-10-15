import { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import type { TransactionFormOutput } from "../../../schema";
import { createCashIncome } from "./cash";
import { createDirectDebtIncome } from "./debt";
import { createDirectInvestmentPurchase } from "./investment";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateIncomeTransactionInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createIncomeTransaction({
  db,
  contactId,
  values,
}: CreateIncomeTransactionInput): Promise<string> {
  const accountType = await getAccountType(db, values.account_id);

  if (accountType === "debt") {
    return createDirectDebtIncome({ db, contactId, values });
  }
  if (accountType === "investment") {
    return createDirectInvestmentPurchase({ db, contactId, values });
  }

  return createCashIncome({ db, contactId, values });
}

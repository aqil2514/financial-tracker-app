import { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import type { TransactionFormOutput } from "../../../schema";
import { createCashToCashTransfer } from "./cash";
import { createDebtTransfer } from "./debt";
import { createInvestmentTransfer } from "./investment";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateTransferTransactionInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createTransferTransaction({
  db,
  contactId,
  values,
}: CreateTransferTransactionInput): Promise<string> {
  const accountId = values.account_id;
  const transferAccountId = values.type === "transfer" ? values.transfer_account_id : null;

  if (transferAccountId == null) {
    return createCashToCashTransfer({ db, contactId, values, accountId, transferAccountId: null });
  }

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  let pairKind: ReturnType<typeof classifyAccountPair> | null = null;
  if (sourceType != null && destinationType != null) {
    try {
      pairKind = classifyAccountPair(sourceType, destinationType);
    } catch {
      pairKind = null;
    }
  }

  switch (pairKind) {
    case "cash-debt":
    case "debt-cash":
    case "debt-debt":
      return createDebtTransfer({ db, contactId, values, accountId, transferAccountId });
    case "cash-investment":
    case "investment-cash":
      return createInvestmentTransfer({ db, contactId, values, accountId, transferAccountId });
    case "cash-cash":
    default:
      return createCashToCashTransfer({ db, contactId, values, accountId, transferAccountId });
  }
}

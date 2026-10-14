import { getDb, type Transaction } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import type { TransactionDebtStatus } from "@/shared/debts/use-transaction-debt-status";
import type { TransactionFormOutput } from "../../../../schema";
import { updateCashToCashTransfer } from "./cash";
import { updateDebtTransfer } from "./debt";
import { updateInvestmentTransfer } from "./investment";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateTransferTransactionInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export async function updateTransferTransaction({
  db,
  contactId,
  transaction,
  values,
  status,
  dangerousFieldsChanged,
}: UpdateTransferTransactionInput): Promise<string> {
  const accountId = values.account_id;
  const transferAccountId = values.type === "transfer" ? values.transfer_account_id : null;

  if (transferAccountId == null) {
    return updateCashToCashTransfer({ db, contactId, transaction, values, accountId, transferAccountId: null });
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
      return updateDebtTransfer({
        db,
        contactId,
        transaction,
        values,
        accountId,
        transferAccountId,
        status,
        dangerousFieldsChanged,
      });
    case "cash-investment":
    case "investment-cash":
      return updateInvestmentTransfer({ db, contactId, transaction, values, accountId, transferAccountId });
    case "cash-cash":
    default:
      return updateCashToCashTransfer({ db, contactId, transaction, values, accountId, transferAccountId });
  }
}

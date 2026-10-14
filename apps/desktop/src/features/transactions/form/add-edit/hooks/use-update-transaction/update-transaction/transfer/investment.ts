import { getDb, type Transaction } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { applyInvestmentTransactionEdit } from "@/shared/investments/apply-investment-transaction";
import {
  applySellInvestmentTransactionEdit,
  InsufficientInvestmentUnitsError,
} from "@/shared/investments/apply-sell-investment-transaction";
import { getAverageCostPerUnit, getRemainingUnit } from "@/shared/investments/investment-holding-math";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { updateTransactionToDb, applyLabelsAndPush } from "../../../helper";
import type { TransactionFormOutput } from "../../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateInvestmentTransferInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
  accountId: string;
  transferAccountId: string;
};

export async function updateInvestmentTransfer({
  db,
  contactId,
  transaction,
  values,
  accountId,
  transferAccountId,
}: UpdateInvestmentTransferInput): Promise<string> {
  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);
  const isInvestmentSell =
    sourceType != null &&
    destinationType != null &&
    classifyAccountPair(sourceType, destinationType) === "investment-cash";

  let amount = values.amount;
  if (isInvestmentSell && values.unit != null) {
    const [averageCost, remainingUnit] = await Promise.all([
      getAverageCostPerUnit(db, accountId),
      getRemainingUnit(db, accountId),
    ]);
    if (values.unit > remainingUnit) {
      throw new InsufficientInvestmentUnitsError(remainingUnit, values.unit);
    }
    amount = averageCost * values.unit;
  }

  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount,
    transferAccountId,
    values,
  });

  let adjustmentTransactionId: string | null = null;
  let investmentPurchaseId: string | null = null;
  let deletedInvestmentPurchaseIds: string[] = [];
  let investmentSaleId: string | null = null;
  let deletedInvestmentSaleIds: string[] = [];
  if (isInvestmentSell) {
    const touched = await applySellInvestmentTransactionEdit(transaction.id, {
      db,
      transactionId: transaction.id,
      accountId,
      transferAccountId,
      date: values.date,
      unit: values.unit as number,
      pricePerUnit: values.price_per_unit as number,
      status: "settled",
    });
    adjustmentTransactionId = touched.adjustmentTransactionId;
    investmentSaleId = touched.investmentSaleIds[0] ?? null;
    deletedInvestmentSaleIds = touched.deletedInvestmentSaleIds;
  } else {
    const touched = await applyInvestmentTransactionEdit({
      db,
      transactionId: transaction.id,
      type: values.type,
      accountId,
      transferAccountId,
      date: values.date,
      unit: values.unit,
      pricePerUnit: values.price_per_unit,
      status: values.investment_status ?? "pending",
    });
    investmentPurchaseId = touched.investmentPurchaseIds[0] ?? null;
    deletedInvestmentPurchaseIds = touched.deletedInvestmentPurchaseIds;
  }

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  if (adjustmentTransactionId != null) void pushOnWrite("transactions", adjustmentTransactionId);
  if (investmentPurchaseId != null) void pushOnWrite("investment_purchases", investmentPurchaseId);
  if (investmentSaleId != null) void pushOnWrite("investment_sales", investmentSaleId);
  for (const purchaseId of deletedInvestmentPurchaseIds)
    void pushDeleteOnWrite("investment_purchases", purchaseId, {});
  for (const saleId of deletedInvestmentSaleIds) void pushDeleteOnWrite("investment_sales", saleId, {});

  return transactionId;
}

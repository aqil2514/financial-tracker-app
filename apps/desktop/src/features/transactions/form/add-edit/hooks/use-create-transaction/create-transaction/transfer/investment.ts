import { getDb } from "@/lib/db";
import { getAccountType } from "@/lib/db/helper";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { applyInvestmentTransaction } from "@/shared/investments/apply-investment-transaction";
import {
  applySellInvestmentTransaction,
  InsufficientInvestmentUnitsError,
} from "@/shared/investments/apply-sell-investment-transaction";
import { getAverageCostPerUnit, getRemainingUnit } from "@/shared/investments/investment-holding-math";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { insertTransactionToDb, applyLabelsAndPush } from "../../../helper";
import type { TransactionFormOutput } from "../../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateInvestmentTransferInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
  accountId: string;
  transferAccountId: string;
};

export async function createInvestmentTransfer({
  db,
  contactId,
  values,
  accountId,
  transferAccountId,
}: CreateInvestmentTransferInput): Promise<string> {
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

  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount,
    transferAccountId,
    values,
  });

  let adjustmentTransactionId: string | null = null;
  let investmentPurchaseId: string | null = null;
  let investmentSaleId: string | null = null;
  if (isInvestmentSell) {
    const touched = await applySellInvestmentTransaction({
      db,
      transactionId,
      accountId,
      transferAccountId,
      date: values.date,
      unit: values.unit as number,
      pricePerUnit: values.price_per_unit as number,
      status: "settled",
    });
    adjustmentTransactionId = touched.adjustmentTransactionId;
    investmentSaleId = touched.investmentSaleIds[0] ?? null;
  } else {
    const touched = await applyInvestmentTransaction({
      db,
      transactionId,
      type: values.type,
      accountId,
      transferAccountId,
      date: values.date,
      unit: values.unit,
      pricePerUnit: values.price_per_unit,
      status: values.investment_status ?? "pending",
    });
    investmentPurchaseId = touched.investmentPurchaseIds[0] ?? null;
  }

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });

  if (adjustmentTransactionId != null) void pushOnWrite("transactions", adjustmentTransactionId);
  if (investmentPurchaseId != null) void pushOnWrite("investment_purchases", investmentPurchaseId);
  if (investmentSaleId != null) void pushOnWrite("investment_sales", investmentSaleId);

  return transactionId;
}

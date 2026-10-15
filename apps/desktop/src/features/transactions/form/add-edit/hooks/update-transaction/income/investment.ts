import { getDb, type Transaction } from "@/lib/db";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite, pushDeleteOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applyInvestmentTransactionEdit } from "@/shared/investments/apply-investment-transaction";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateDirectInvestmentPurchaseInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
};

export async function updateDirectInvestmentPurchase({
  db,
  contactId,
  transaction,
  values,
}: UpdateDirectInvestmentPurchaseInput): Promise<string> {
  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  const touched = await applyInvestmentTransactionEdit({
    db,
    transactionId: transaction.id,
    type: values.type,
    accountId: values.account_id,
    transferAccountId: null,
    date: values.date,
    unit: values.unit,
    pricePerUnit: values.price_per_unit,
    status: "settled",
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  for (const purchaseId of touched.investmentPurchaseIds) void pushOnWrite("investment_purchases", purchaseId);
  for (const purchaseId of touched.deletedInvestmentPurchaseIds)
    void pushDeleteOnWrite("investment_purchases", purchaseId, {});

  return transactionId;
}

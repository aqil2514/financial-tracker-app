import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { insertTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateDirectInvestmentPurchaseInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createDirectInvestmentPurchase({
  db,
  contactId,
  values,
}: CreateDirectInvestmentPurchaseInput): Promise<string> {
  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount: values.amount,
    transferAccountId: null,
    values,
  });

  const investmentPurchaseId = newId();
  await db.execute(
    `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'settled')`,
    [investmentPurchaseId, values.account_id, transactionId, values.unit, values.price_per_unit, values.date]
  );

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  void pushOnWrite("investment_purchases", investmentPurchaseId);

  return transactionId;
}

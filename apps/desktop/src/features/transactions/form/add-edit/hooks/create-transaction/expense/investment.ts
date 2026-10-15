import { getDb } from "@/lib/db";
import { newId } from "@/lib/id";
import { insertTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import {
  InsufficientInvestmentUnitsError,
} from "@/shared/investments/apply-sell-investment-transaction";
import { getAverageCostPerUnit, getRemainingUnit } from "@/shared/investments/investment-holding-math";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type CreateDirectInvestmentWriteOffInput = {
  db: Db;
  contactId: string | null;
  values: TransactionFormOutput;
};

export async function createDirectInvestmentWriteOff({
  db,
  contactId,
  values,
}: CreateDirectInvestmentWriteOffInput): Promise<string> {
  const unit = values.unit as number;

  const [averageCost, remainingUnit] = await Promise.all([
    getAverageCostPerUnit(db, values.account_id),
    getRemainingUnit(db, values.account_id),
  ]);
  if (unit > remainingUnit) {
    throw new InsufficientInvestmentUnitsError(remainingUnit, unit);
  }

  const amount = averageCost * unit;
  const realizedPl = -amount;

  const transactionId = await insertTransactionToDb({
    db,
    contactId,
    amount,
    transferAccountId: null,
    values,
  });

  const investmentSaleId = newId();
  await db.execute(
    `INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status)
     VALUES ($1, $2, $3, NULL, $4, 0, $5, $6, $7, 'settled')`,
    [investmentSaleId, values.account_id, transactionId, unit, averageCost, realizedPl, values.date]
  );

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  void pushOnWrite("investment_sales", investmentSaleId);

  return transactionId;
}

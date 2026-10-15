import { getDb, type Transaction } from "@/lib/db";
import { newId } from "@/lib/id";
import { updateTransactionToDb, applyLabelsAndPush } from "../../helper";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import {
  applyWriteOffInvestmentTransactionEdit,
  getTransactionWriteOff,
} from "@/shared/investments/apply-write-off-investment-transaction";
import {
  InsufficientInvestmentUnitsError,
} from "@/shared/investments/apply-sell-investment-transaction";
import { getAverageCostPerUnit, getRemainingUnit } from "@/shared/investments/investment-holding-math";
import type { TransactionFormOutput } from "../../../schema";

type Db = Awaited<ReturnType<typeof getDb>>;

type UpdateDirectInvestmentWriteOffInput = {
  db: Db;
  contactId: string | null;
  transaction: Transaction;
  values: TransactionFormOutput;
};

export async function updateDirectInvestmentWriteOff({
  db,
  contactId,
  transaction,
  values,
}: UpdateDirectInvestmentWriteOffInput): Promise<string> {
  const unit = values.unit as number;
  const existing = await getTransactionWriteOff(db, transaction.id);

  const remainingUnit = await getRemainingUnit(db, values.account_id);
  const remainingUnitExcludingThis = remainingUnit + (existing?.unit ?? 0);
  if (unit > remainingUnitExcludingThis) {
    throw new InsufficientInvestmentUnitsError(remainingUnitExcludingThis, unit);
  }

  let amount: number;
  let investmentSaleId: string | null = null;

  if (existing == null) {
    const averageCost = await getAverageCostPerUnit(db, values.account_id);
    amount = averageCost * unit;
    const realizedPl = -amount;

    investmentSaleId = newId();
    const transactionId = await updateTransactionToDb({
      db,
      transactionId: transaction.id,
      contactId,
      amount,
      transferAccountId: null,
      values,
    });
    await db.execute(
      `INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status)
       VALUES ($1, $2, $3, NULL, $4, 0, $5, $6, $7, 'settled')`,
      [investmentSaleId, values.account_id, transactionId, unit, averageCost, realizedPl, values.date]
    );

    await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
    void pushOnWrite("investment_sales", investmentSaleId);
    return transactionId;
  }

  const result = await applyWriteOffInvestmentTransactionEdit({
    db,
    transactionId: transaction.id,
    accountId: values.account_id,
    unit,
  });
  amount = result.amount;

  const transactionId = await updateTransactionToDb({
    db,
    transactionId: transaction.id,
    contactId,
    amount,
    transferAccountId: null,
    values,
  });

  await applyLabelsAndPush({ transactionId, labelNames: values.label_names });
  void pushOnWrite("investment_sales", existing.id);

  return transactionId;
}

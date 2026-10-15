import { newId } from "@/lib/id";
import { remainingDebtSql } from "../remaining-debt-sql";
import type { Db, TouchedDebtRows } from "./types";

type OngoingDebtRow = { id: string; remaining: number };

export async function settleDebtsFifo({
  db,
  transactionId,
  accountId,
  amount,
  date,
  settleDebtIds,
}: {
  db: Db;
  transactionId: string;
  accountId: string;
  amount: number;
  date: string;
  settleDebtIds: string[];
}): Promise<TouchedDebtRows> {
  if (settleDebtIds.length === 0)
    return { debtIds: [], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };

  const placeholders = settleDebtIds.map((_, i) => `$${i + 1}`).join(", ");
  const debts = await db.select<OngoingDebtRow[]>(
    `SELECT
       debts.id,
       ${remainingDebtSql()} AS remaining
     FROM debts
     WHERE debts.id IN (${placeholders})
     ORDER BY debts.date ASC, debts.id ASC`,
    settleDebtIds
  );

  const touchedDebtIds: string[] = [];
  const touchedDebtPaymentIds: string[] = [];
  let remainingToAllocate = amount;
  for (const debt of debts) {
    if (remainingToAllocate <= 0) break;
    const allocation = Math.min(debt.remaining, remainingToAllocate);
    if (allocation <= 0) continue;

    const paymentId = newId();
    await db.execute(
      `INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [paymentId, debt.id, allocation, accountId, transactionId, date]
    );
    touchedDebtPaymentIds.push(paymentId);

    if (allocation >= debt.remaining) {
      await db.execute("UPDATE debts SET status = 'paid' WHERE id = $1", [debt.id]);
      touchedDebtIds.push(debt.id);
    }

    remainingToAllocate -= allocation;
  }

  return { debtIds: touchedDebtIds, debtPaymentIds: touchedDebtPaymentIds, deletedDebtIds: [], deletedDebtPaymentIds: [] };
}

import { getTransactionDebtStatus } from "../use-transaction-debt-status";
import type { Db } from "./types";

export type DeletedTransactionDebtInfo =
  | { role: "none" }
  | { role: "payment"; debtId: string }
  | { role: "principal"; debtId: string; hadPayments: boolean };

export async function detachDebtForDeletedTransaction(
  db: Db,
  transactionId: string
): Promise<DeletedTransactionDebtInfo> {
  const status = await getTransactionDebtStatus(db, transactionId);

  if (status.role === "none") {
    return { role: "none" };
  }

  if (status.role === "payment") {
    await db.execute("DELETE FROM debt_payments WHERE id = $1", [status.debtPaymentId]);
    await db.execute(
      `UPDATE debts SET status = 'ongoing'
       WHERE id = $1 AND status = 'paid' AND amount > COALESCE(
         (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
         0
       )`,
      [status.debtId]
    );
    return { role: "payment", debtId: status.debtId };
  }

  // status.role === "principal"
  await db.execute("UPDATE debts SET transaction_id = NULL WHERE id = $1", [status.debtId]);
  return { role: "principal", debtId: status.debtId, hadPayments: status.hasPayments };
}

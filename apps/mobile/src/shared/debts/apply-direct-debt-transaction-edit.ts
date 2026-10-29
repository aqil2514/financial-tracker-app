import {
  applyDirectDebtTransaction,
  type ApplyDirectDebtTransactionInput,
} from "./apply-direct-debt-transaction";
import { DebtEditBlockedError, DebtSelfSettlementError } from "./apply-debt-transaction-edit";
import type { TransactionDebtStatus } from "./transaction-debt-status";
import { mergeTouchedDebtRows, type TouchedDebtRows } from "./types";

export type ApplyDirectDebtTransactionEditInput = ApplyDirectDebtTransactionInput & {
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export { DebtEditBlockedError, DebtSelfSettlementError };

export async function applyDirectDebtTransactionEdit({
  status,
  dangerousFieldsChanged,
  ...input
}: ApplyDirectDebtTransactionEditInput): Promise<TouchedDebtRows> {
  const { db, date } = input;

  if (status.role === "none") {
    return applyDirectDebtTransaction(input);
  }

  if (status.role === "principal") {
    if (!dangerousFieldsChanged) {
      await db.runAsync("UPDATE debts SET date = ? WHERE id = ?", [date, status.debtId]);
      return { debtIds: [status.debtId], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
    }
    if (status.hasPayments) {
      throw new DebtEditBlockedError();
    }
    if (input.settleDebtIds.includes(status.debtId)) {
      throw new DebtSelfSettlementError();
    }
    await db.runAsync("DELETE FROM debts WHERE id = ?", [status.debtId]);
    return mergeTouchedDebtRows(
      { debtIds: [], debtPaymentIds: [], deletedDebtIds: [status.debtId], deletedDebtPaymentIds: [] },
      await applyDirectDebtTransaction(input)
    );
  }

  // status.role === "payment"
  if (!dangerousFieldsChanged) {
    await db.runAsync("UPDATE debt_payments SET date = ? WHERE id = ?", [date, status.debtPaymentId]);
    return { debtIds: [], debtPaymentIds: [status.debtPaymentId], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  await db.runAsync("DELETE FROM debt_payments WHERE id = ?", [status.debtPaymentId]);
  await db.runAsync(
    `UPDATE debts SET status = 'ongoing'
     WHERE id = ? AND status = 'paid' AND amount > COALESCE(
       (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
       0
     )`,
    [status.debtId]
  );
  return mergeTouchedDebtRows(
    { debtIds: [status.debtId], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [status.debtPaymentId] },
    await applyDirectDebtTransaction(input)
  );
}

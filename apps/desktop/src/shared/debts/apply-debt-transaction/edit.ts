import type { TransactionDebtStatus } from "../use-transaction-debt-status";
import { applyDebtTransaction, type ApplyDebtTransactionInput } from "./create";
import { mergeTouchedDebtRows, type TouchedDebtRows } from "./types";

export type ApplyDebtTransactionEditInput = ApplyDebtTransactionInput & {
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export class DebtEditBlockedError extends Error {
  constructor() {
    super(
      "Piutang ini sudah menerima cicilan dari transaksi lain — nominal/akun/kontak tidak bisa diubah dari sini."
    );
    this.name = "DebtEditBlockedError";
  }
}

export async function applyDebtTransactionEdit({
  status,
  dangerousFieldsChanged,
  ...input
}: ApplyDebtTransactionEditInput): Promise<TouchedDebtRows> {
  const { db, date } = input;

  if (status.role === "none") {
    return applyDebtTransaction(input);
  }

  if (status.role === "principal") {
    if (!dangerousFieldsChanged) {
      await db.execute("UPDATE debts SET date = $1 WHERE id = $2", [date, status.debtId]);
      return { debtIds: [status.debtId], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
    }
    if (status.hasPayments) {
      throw new DebtEditBlockedError();
    }
    await db.execute("DELETE FROM debts WHERE id = $1", [status.debtId]);
    return mergeTouchedDebtRows(
      { debtIds: [], debtPaymentIds: [], deletedDebtIds: [status.debtId], deletedDebtPaymentIds: [] },
      await applyDebtTransaction(input)
    );
  }

  // status.role === "payment"
  if (!dangerousFieldsChanged) {
    await db.execute("UPDATE debt_payments SET date = $1 WHERE id = $2", [
      date,
      status.debtPaymentId,
    ]);
    return { debtIds: [], debtPaymentIds: [status.debtPaymentId], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  await db.execute("DELETE FROM debt_payments WHERE id = $1", [status.debtPaymentId]);
  await db.execute(
    `UPDATE debts SET status = 'ongoing'
     WHERE id = $1 AND status = 'paid' AND amount > COALESCE(
       (SELECT SUM(amount) FROM debt_payments WHERE debt_payments.debt_id = debts.id),
       0
     )`,
    [status.debtId]
  );
  return mergeTouchedDebtRows(
    { debtIds: [status.debtId], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [status.debtPaymentId] },
    await applyDebtTransaction(input)
  );
}

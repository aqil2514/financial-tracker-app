import { applyDebtTransaction, type ApplyDebtTransactionInput } from "./apply-debt-transaction";
import type { TransactionDebtStatus } from "./transaction-debt-status";
import { mergeTouchedDebtRows, type TouchedDebtRows } from "./types";

export type ApplyDebtTransactionEditInput = ApplyDebtTransactionInput & {
  status: TransactionDebtStatus;
  dangerousFieldsChanged: boolean;
};

export class DebtEditBlockedError extends Error {
  constructor() {
    super(
      "Piutang/utang ini sudah menerima cicilan dari transaksi lain — nominal/akun/kontak tidak bisa diubah dari sini."
    );
    this.name = "DebtEditBlockedError";
  }
}

// Dilempar kalau settleDebtIds menyertakan debt MILIK transaksi ini
// sendiri (role: 'principal') — baris itu akan DIHAPUS lebih dulu di
// fungsi ini sebelum applyDebtTransaction/settleDebtsFifo sempat
// membacanya, jadi kalau diizinkan lolos, settlement-nya gagal SENYAP.
// UI (useOngoingDebts dengan exclude) seharusnya sudah mencegah pilihan
// ini muncul — guard ini jaring pengaman kalau ada jalur lain.
export class DebtSelfSettlementError extends Error {
  constructor() {
    super(
      "Tidak bisa melunasi piutang/utang yang berasal dari transaksi ini sendiri — pilih yang lain, atau batalkan perubahan akun/nominal pada transaksi ini."
    );
    this.name = "DebtSelfSettlementError";
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
      await applyDebtTransaction(input)
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
    await applyDebtTransaction(input)
  );
}

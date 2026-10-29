import type { Db } from "./types";

// Peran sebuah transaction_id terhadap debts/debt_payments — menentukan
// field mana yang boleh diedit bebas dan strategi apa (recreate/update/
// lock) yang dipakai applyDebtTransactionEdit/applyDirectDebtTransactionEdit
// saat submit. Pola sama seperti use-transaction-debt-status.ts desktop,
// versi query murni (bukan hook — db diterima sebagai parameter).
export type TransactionDebtStatus =
  | { role: "none" }
  | { role: "principal"; debtId: string; hasPayments: boolean }
  | { role: "payment"; debtPaymentId: string; debtId: string };

export async function getTransactionDebtStatus(db: Db, transactionId: string): Promise<TransactionDebtStatus> {
  const asPrincipal = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM debts WHERE transaction_id = ? LIMIT 1",
    [transactionId]
  );
  if (asPrincipal) {
    const payments = await db.getFirstAsync<{ found: number }>(
      "SELECT EXISTS(SELECT 1 FROM debt_payments WHERE debt_id = ?) AS found",
      [asPrincipal.id]
    );
    return { role: "principal", debtId: asPrincipal.id, hasPayments: payments?.found === 1 };
  }

  const asPayment = await db.getFirstAsync<{ id: string; debt_id: string }>(
    "SELECT id, debt_id FROM debt_payments WHERE transaction_id = ? LIMIT 1",
    [transactionId]
  );
  if (asPayment) {
    return { role: "payment", debtPaymentId: asPayment.id, debtId: asPayment.debt_id };
  }

  return { role: "none" };
}

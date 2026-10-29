import { createDebt, requireDebtAccountDirection } from "./create-debt";
import { settleDebtsFifo } from "./settle-debts-fifo";
import type { Db, TouchedDebtRows } from "./types";

export type ApplyDirectDebtTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense";
  accountId: string;
  contactId: string | null;
  amount: number;
  date: string;
  settleDebtIds: string[];
};

// Jalur 2 — income/expense langsung di akun debt, tanpa kas berpindah.
export async function applyDirectDebtTransaction({
  db,
  transactionId,
  type,
  accountId,
  contactId,
  amount,
  date,
  settleDebtIds,
}: ApplyDirectDebtTransactionInput): Promise<TouchedDebtRows> {
  const direction = await requireDebtAccountDirection(db, accountId);

  const createsNewDebt =
    (direction === "payable" && type === "expense") || (direction === "receivable" && type === "income");

  if (createsNewDebt) {
    return createDebt({ db, type: direction, contactId, amount, accountId, transactionId, date });
  }

  return settleDebtsFifo({ db, transactionId, accountId, amount, date, settleDebtIds });
}

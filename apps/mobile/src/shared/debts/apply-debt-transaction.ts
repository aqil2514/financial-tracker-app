import { classifyAccountPair } from "./classify-account-pair";
import { createDebt, requireDebtAccountDirection } from "./create-debt";
import { settleDebtsFifo } from "./settle-debts-fifo";
import { NO_TOUCHED_DEBT_ROWS, type Db, type TouchedDebtRows } from "./types";

export type ApplyDebtTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  contactId: string | null;
  amount: number;
  date: string;
  settleDebtIds: string[];
};

async function getAccountType(db: Db, accountId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ account_type: string }>(
    "SELECT account_type FROM accounts WHERE id = ?",
    [accountId]
  );
  return row?.account_type ?? null;
}

// Jalur 1 — transfer kas<->debt. Hanya aktif untuk type === "transfer";
// jalur lain (income/expense langsung di akun debt) ada di
// apply-direct-debt-transaction.ts.
export async function applyDebtTransaction({
  db,
  transactionId,
  type,
  accountId,
  transferAccountId,
  contactId,
  amount,
  date,
  settleDebtIds,
}: ApplyDebtTransactionInput): Promise<TouchedDebtRows> {
  if (type !== "transfer" || transferAccountId == null) return NO_TOUCHED_DEBT_ROWS;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  const pairKind = classifyAccountPair(sourceType, destinationType);

  if (pairKind === "cash-cash" || pairKind === "debt-debt") {
    return NO_TOUCHED_DEBT_ROWS;
  }

  if (pairKind === "cash-debt") {
    const direction = await requireDebtAccountDirection(db, transferAccountId);
    if (direction === "receivable") {
      return createDebt({
        db,
        type: "receivable",
        contactId,
        amount,
        accountId: transferAccountId,
        transactionId,
        date,
      });
    }
    return settleDebtsFifo({ db, transactionId, accountId: transferAccountId, amount, date, settleDebtIds });
  }

  const direction = await requireDebtAccountDirection(db, accountId);
  if (direction === "payable") {
    return createDebt({ db, type: "payable", contactId, amount, accountId, transactionId, date });
  }
  return settleDebtsFifo({ db, transactionId, accountId, amount, date, settleDebtIds });
}

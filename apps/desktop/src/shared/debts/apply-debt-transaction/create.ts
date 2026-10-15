import type { Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { classifyAccountPair } from "../classify-account-pair";
import { settleDebtsFifo } from "./settle-fifo";
import type { Db, TouchedDebtRows } from "./types";

export type ApplyDebtTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  contactId: string | null;
  amount: number;
  date: string;
  debtAction: "settlement" | "payable" | null;
  settleDebtIds: string[];
};

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

export async function applyDebtTransaction({
  db,
  transactionId,
  type,
  accountId,
  transferAccountId,
  contactId,
  amount,
  date,
  debtAction,
  settleDebtIds,
}: ApplyDebtTransactionInput): Promise<TouchedDebtRows> {
  const none: TouchedDebtRows = { debtIds: [], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  if (type !== "transfer" || transferAccountId == null) return none;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  const pairKind = classifyAccountPair(sourceType, destinationType);

  if (pairKind === "cash-cash" || pairKind === "debt-debt" || pairKind === "cash-investment") {
    return none;
  }

  if (pairKind === "cash-debt") {
    const id = newId();
    await db.execute(
      `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
       VALUES ($1, 'receivable', $2, $3, $4, $5, $6)`,
      [id, contactId, amount, transferAccountId, transactionId, date]
    );
    return { debtIds: [id], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  // pairKind === "debt-cash"
  if (debtAction === "payable") {
    const id = newId();
    await db.execute(
      `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
       VALUES ($1, 'payable', $2, $3, $4, $5, $6)`,
      [id, contactId, amount, accountId, transactionId, date]
    );
    return { debtIds: [id], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
  }

  if (debtAction === "settlement") {
    return settleDebtsFifo({ db, transactionId, accountId, amount, date, settleDebtIds });
  }

  return none;
}

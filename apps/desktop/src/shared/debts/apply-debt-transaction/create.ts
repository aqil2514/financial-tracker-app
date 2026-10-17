import type { Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { classifyAccountPair } from "../classify-account-pair";
import { settleDebtsFifo } from "./settle-fifo";
import type { Db, TouchedDebtRows } from "./types";

export class DebtAccountDirectionMissingError extends Error {
  constructor(accountName: string) {
    super(
      `Akun "${accountName}" belum punya arah (Piutang/Utang) yang ditentukan — lengkapi dulu lewat "Edit Akun" sebelum dipakai di transaksi utang piutang.`
    );
    this.name = "DebtAccountDirectionMissingError";
  }
}

async function getDebtAccountDirection(
  db: Db,
  accountId: string
): Promise<{ name: string; direction: "receivable" | "payable" } | null> {
  const rows = await db.select<{ name: string; direction: "receivable" | "payable" }[]>(
    `SELECT accounts.name, debt_accounts.direction FROM debt_accounts
     JOIN accounts ON accounts.id = debt_accounts.account_id
     WHERE debt_accounts.account_id = $1`,
    [accountId]
  );
  return rows[0] ?? null;
}

async function requireDebtAccountDirection(
  db: Db,
  accountId: string
): Promise<"receivable" | "payable"> {
  const rows = await db.select<{ name: string }[]>("SELECT name FROM accounts WHERE id = $1", [accountId]);
  const detail = await getDebtAccountDirection(db, accountId);
  if (!detail) throw new DebtAccountDirectionMissingError(rows[0]?.name ?? accountId);
  return detail.direction;
}

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

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

async function createDebt({
  db,
  type,
  contactId,
  amount,
  accountId,
  transactionId,
  date,
}: {
  db: Db;
  type: "receivable" | "payable";
  contactId: string | null;
  amount: number;
  accountId: string;
  transactionId: string;
  date: string;
}): Promise<TouchedDebtRows> {
  const id = newId();
  await db.execute(
    `INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, type, contactId, amount, accountId, transactionId, date]
  );
  return { debtIds: [id], debtPaymentIds: [], deletedDebtIds: [], deletedDebtPaymentIds: [] };
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
    const direction = await requireDebtAccountDirection(db, transferAccountId);
    if (direction === "receivable") {
      return createDebt({ db, type: "receivable", contactId, amount, accountId: transferAccountId, transactionId, date });
    }
    return settleDebtsFifo({ db, transactionId, accountId: transferAccountId, amount, date, settleDebtIds });
  }

  const direction = await requireDebtAccountDirection(db, accountId);
  if (direction === "payable") {
    return createDebt({ db, type: "payable", contactId, amount, accountId, transactionId, date });
  }
  return settleDebtsFifo({ db, transactionId, accountId, amount, date, settleDebtIds });
}

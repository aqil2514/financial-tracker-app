import type { Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { none, type Db, type TouchedInvestmentRows } from "./types";

export type ApplyInvestmentTransactionInput = {
  db: Db;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  date: string;
  unit: number | null;
  pricePerUnit: number | null;
  status?: "pending" | "settled";
};

async function getAccountType(db: Db, accountId: string): Promise<Account["account_type"] | null> {
  const rows = await db.select<Pick<Account, "account_type">[]>(
    "SELECT account_type FROM accounts WHERE id = $1",
    [accountId]
  );
  return rows[0]?.account_type ?? null;
}

export async function applyInvestmentTransaction({
  db,
  transactionId,
  type,
  accountId,
  transferAccountId,
  date,
  unit,
  pricePerUnit,
  status = "pending",
}: ApplyInvestmentTransactionInput): Promise<TouchedInvestmentRows> {
  if (type !== "transfer" || transferAccountId == null) return none;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  const pairKind = classifyAccountPair(sourceType, destinationType);

  if (pairKind !== "cash-investment") return none;

  const id = newId();
  await db.execute(
    `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, transferAccountId, transactionId, unit, pricePerUnit, date, status]
  );
  return { investmentPurchaseIds: [id], deletedInvestmentPurchaseIds: [] };
}

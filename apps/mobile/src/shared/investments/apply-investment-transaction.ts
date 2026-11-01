import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";

export type ApplyInvestmentTransactionInput = {
  db: SQLiteDatabase;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  date: string;
  unit: number | null;
  pricePerUnit: number | null;
  status?: "pending" | "settled";
};

export type TouchedInvestmentRows = {
  investmentPurchaseIds: string[];
};

const NONE: TouchedInvestmentRows = { investmentPurchaseIds: [] };

async function getAccountType(db: SQLiteDatabase, accountId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ account_type: string }>(
    "SELECT account_type FROM accounts WHERE id = ?",
    [accountId]
  );
  return row?.account_type ?? null;
}

// Dipanggil SETELAH baris transactions di-INSERT (butuh transactionId). Hanya transfer kas -> investasi
// yang melahirkan investment_purchases (default 'pending', unit/harga independen dari nominal transfer
// dan TIDAK divalidasi terhadapnya). Jual (investasi -> kas) bukan urusan fungsi ini.
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
  if (type !== "transfer" || transferAccountId == null) return NONE;

  const [sourceType, destinationType] = await Promise.all([
    getAccountType(db, accountId),
    getAccountType(db, transferAccountId),
  ]);

  if (sourceType == null || destinationType == null) {
    throw new Error("Akun sumber/tujuan transfer tidak ditemukan.");
  }

  if (classifyAccountPair(sourceType, destinationType) !== "cash-investment") return NONE;

  const id = generateId();
  await db.runAsync(
    `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, transferAccountId, transactionId, unit, pricePerUnit, date, status]
  );
  return { investmentPurchaseIds: [id] };
}

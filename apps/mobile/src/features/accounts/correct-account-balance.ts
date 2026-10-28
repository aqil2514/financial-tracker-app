import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database";

const CORRECTION_CATEGORY_NAME = "Penyesuaian Saldo";

async function getOrCreateCorrectionCategoryId(
  db: SQLiteDatabase,
  type: "income" | "expense"
): Promise<string> {
  const existing = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM categories WHERE name = ? AND type = ? LIMIT 1",
    [CORRECTION_CATEGORY_NAME, type]
  );
  if (existing) return existing.id;

  const id = generateId();
  await db.runAsync("INSERT INTO categories (id, name, type, is_active) VALUES (?, ?, ?, 1)", [
    id,
    CORRECTION_CATEGORY_NAME,
    type,
  ]);
  return id;
}

interface CorrectAccountBalanceInput {
  db: SQLiteDatabase;
  accountId: string;
  targetBalance: number;
  currentBalance: number;
  countAsCash: boolean;
}

export async function correctAccountBalance({
  db,
  accountId,
  targetBalance,
  currentBalance,
  countAsCash,
}: CorrectAccountBalanceInput): Promise<void> {
  const diff = targetBalance - currentBalance;
  if (diff === 0) return;

  const type: "income" | "expense" = diff > 0 ? "income" : "expense";
  const amount = Math.abs(diff);
  const isCashNeutral = countAsCash ? 0 : 1;

  const categoryId = await getOrCreateCorrectionCategoryId(db, type);

  await db.runAsync(
    `INSERT INTO transactions (id, type, amount, category_id, account_id, note, date, is_cash_neutral)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), type, amount, categoryId, accountId, "Koreksi saldo", new Date().toISOString(), isCashNeutral]
  );
}

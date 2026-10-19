"use client";

import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";

const CORRECTION_CATEGORY_NAME = "Penyesuaian Saldo";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function resolveIsCashNeutral(accountType: Account["account_type"], countAsCash: boolean): boolean {
  if (accountType === "debt" || accountType === "investment") return true;
  if (accountType === "cash") return !countAsCash;
  return false;
}

export type CorrectAccountBalanceInput = {
  accountId: string;
  accountType: Account["account_type"];
  targetBalance: number;
  currentBalance: number;
  countAsCash: boolean;
};

async function getOrCreateCorrectionCategoryId(
  db: Awaited<ReturnType<typeof getDb>>,
  type: "income" | "expense"
): Promise<string> {
  const existing = await db.select<{ id: string }[]>(
    "SELECT id FROM categories WHERE name = $1 AND type = $2 LIMIT 1",
    [CORRECTION_CATEGORY_NAME, type]
  );
  if (existing.length > 0) return existing[0].id;

  const id = newId();
  await db.execute(
    "INSERT INTO categories (id, name, type, is_active) VALUES ($1, $2, $3, 1)",
    [id, CORRECTION_CATEGORY_NAME, type]
  );
  return id;
}

export function useCorrectAccountBalance() {
  return useDbMutation({
    mutationFn: async ({
      accountId,
      accountType,
      targetBalance,
      currentBalance,
      countAsCash,
    }: CorrectAccountBalanceInput) => {
      const diff = targetBalance - currentBalance;
      if (diff === 0) return;

      const type: "income" | "expense" = diff > 0 ? "income" : "expense";
      const amount = Math.abs(diff);
      const isCashNeutral = resolveIsCashNeutral(accountType, countAsCash);

      const db = await getDb();
      const categoryId = await getOrCreateCorrectionCategoryId(db, type);

      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, note, date, is_cash_neutral)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [newId(), type, amount, categoryId, accountId, "Koreksi saldo", now(), isCashNeutral ? 1 : 0]
      );
    },
    invalidateKey: dependentKeysOf("transactions", "accounts", "categories"),
    successMessage: "Saldo berhasil dikoreksi",
    errorMessage: "Gagal mengoreksi saldo",
  });
}

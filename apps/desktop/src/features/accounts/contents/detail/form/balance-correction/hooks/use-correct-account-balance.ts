"use client";

import { getDb, type Account } from "@/lib/db";
import { newId } from "@/lib/id";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";
import { isAccountTypeRestrictedFromBalanceCorrection } from "@/lib/account-types";
import { pushOnWrite } from "@/shared/cloud-sync/push-on-write";
import { applyInvestmentBalanceCorrection } from "@/shared/investments/apply-investment-balance-correction";

const CORRECTION_CATEGORY_NAME = "Penyesuaian Saldo";

function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function resolveIsCashNeutral(accountType: Account["account_type"], countAsCash: boolean): boolean {
  if (accountType === "debt" || accountType === "investment" || accountType === "third_party") return true;
  if (accountType === "cash") return !countAsCash;
  return false;
}

export type CorrectAccountBalanceInput =
  | {
      mode: "balance";
      accountId: string;
      accountType: Account["account_type"];
      targetBalance: number;
      currentBalance: number;
      countAsCash: boolean;
    }
  | {
      mode: "investment";
      accountId: string;
      unit: number;
      pricePerUnit: number;
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
    mutationFn: async (input: CorrectAccountBalanceInput) => {
      const db = await getDb();

      if (input.mode === "investment") {
        const result = await applyInvestmentBalanceCorrection({
          db,
          accountId: input.accountId,
          getCategoryId: (type) => getOrCreateCorrectionCategoryId(db, type),
          date: now(),
          note: "Koreksi saldo",
          unit: input.unit,
          pricePerUnit: input.pricePerUnit,
        });

        await pushOnWrite("transactions", result.transactionId);
        if (result.investmentPurchaseId) void pushOnWrite("investment_purchases", result.investmentPurchaseId);
        if (result.investmentSaleId) void pushOnWrite("investment_sales", result.investmentSaleId);
        return;
      }

      const { accountId, accountType, targetBalance, currentBalance, countAsCash } = input;
      if (isAccountTypeRestrictedFromBalanceCorrection(accountType)) {
        throw new Error(
          `Saldo akun bertipe '${accountType}' tidak bisa dikoreksi langsung karena derived dari data piutang/utang atau dana pihak ketiga -- gunakan transaksi transfer atau perbaiki transaksi akar penyebabnya.`
        );
      }

      const diff = targetBalance - currentBalance;
      if (diff === 0) return;

      const diffType: "income" | "expense" = diff > 0 ? "income" : "expense";
      const amount = Math.abs(diff);
      const isCashNeutral = resolveIsCashNeutral(accountType, countAsCash);

      const categoryId = await getOrCreateCorrectionCategoryId(db, diffType);

      const transactionId = newId();
      await db.execute(
        `INSERT INTO transactions (id, type, amount, category_id, account_id, note, date, is_cash_neutral)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [transactionId, diffType, amount, categoryId, accountId, "Koreksi saldo", now(), isCashNeutral ? 1 : 0]
      );
      await pushOnWrite("transactions", transactionId);
    },
    invalidateKey: dependentKeysOf("transactions", "accounts", "categories"),
    successMessage: "Saldo berhasil dikoreksi",
    errorMessage: "Gagal mengoreksi saldo",
  });
}

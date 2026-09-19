"use client";

import { getDb } from "@/lib/db";
import { useDbMutation } from "@/hooks/use-db-mutation";
import { dependentKeysOf } from "@/lib/query-dependencies";

const CORRECTION_CATEGORY_NAME = "Penyesuaian Saldo";

// Format sama seperti now() di use-create-transaction.ts (ISO lokal
// "YYYY-MM-DDTHH:MM") — BUKAN datetime('now') SQLite yang menghasilkan
// "YYYY-MM-DD HH:MM:SS" (pakai spasi, bukan "T"), karena formatDate()
// mendeteksi ada-tidaknya waktu lewat cek literal "T" pada string date.
function now() {
  const date = new Date();
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export type CorrectAccountBalanceInput = {
  accountId: number;
  /** Saldo yang seharusnya sekarang, diinput user. */
  targetBalance: number;
  /** Saldo berjalan saat ini (dihitung), dipakai untuk cari selisihnya. */
  currentBalance: number;
};

/** Kategori "Penyesuaian Saldo" dibuat sekali per tipe (income/expense)
 * saat pertama kali dipakai — supaya transaksi koreksi tetap punya
 * kategori untuk difilter/dilaporkan, tanpa perlu setup manual dulu. */
async function getOrCreateCorrectionCategoryId(
  db: Awaited<ReturnType<typeof getDb>>,
  type: "income" | "expense"
): Promise<number> {
  const existing = await db.select<{ id: number }[]>(
    "SELECT id FROM categories WHERE name = $1 AND type = $2 LIMIT 1",
    [CORRECTION_CATEGORY_NAME, type]
  );
  if (existing.length > 0) return existing[0].id;

  const result = await db.execute(
    "INSERT INTO categories (name, type, is_active) VALUES ($1, $2, 1)",
    [CORRECTION_CATEGORY_NAME, type]
  );
  return result.lastInsertId as number;
}

export function useCorrectAccountBalance() {
  return useDbMutation({
    mutationFn: async ({ accountId, targetBalance, currentBalance }: CorrectAccountBalanceInput) => {
      const diff = targetBalance - currentBalance;
      if (diff === 0) return;

      const type: "income" | "expense" = diff > 0 ? "income" : "expense";
      const amount = Math.abs(diff);

      const db = await getDb();
      const categoryId = await getOrCreateCorrectionCategoryId(db, type);

      await db.execute(
        `INSERT INTO transactions (type, amount, category_id, account_id, note, date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [type, amount, categoryId, accountId, "Koreksi saldo", now()]
      );
    },
    invalidateKey: dependentKeysOf("transactions", "accounts", "categories"),
    successMessage: "Saldo berhasil dikoreksi",
    errorMessage: "Gagal mengoreksi saldo",
  });
}

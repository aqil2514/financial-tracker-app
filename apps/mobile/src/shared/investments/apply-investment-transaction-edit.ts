import type { SQLiteDatabase } from "expo-sqlite";
import { classifyAccountPair } from "@/shared/debts/classify-account-pair";
import { applyInvestmentTransaction } from "./apply-investment-transaction";
import { assertPurchaseEditKeepsUnitsValid, type ExistingPurchase } from "./investment-purchase-edit-guard";

export type ApplyInvestmentTransactionEditInput = {
  db: SQLiteDatabase;
  transactionId: string;
  type: "income" | "expense" | "transfer";
  accountId: string;
  transferAccountId: string | null;
  date: string;
};

type ExistingRow = ExistingPurchase & { id: string };

async function getAccountType(db: SQLiteDatabase, accountId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ account_type: string }>("SELECT account_type FROM accounts WHERE id = ?", [
    accountId,
  ]);
  return row?.account_type ?? null;
}

// Dipanggil dari form transaksi utama, yang tidak punya field unit/harga/status — jadi nilai itu TIDAK
// disentuh di sini (diubah lewat layar Edit Pembelian). Yang disinkronkan: tanggal dan akun investasi tujuan.
// Panggil SEBELUM meng-UPDATE baris transactions supaya penolakan tidak meninggalkan tulisan setengah jadi.
export async function applyInvestmentTransactionEdit(input: ApplyInvestmentTransactionEditInput) {
  const { db, transactionId, type, accountId, transferAccountId, date } = input;

  const existing = await db.getFirstAsync<ExistingRow>(
    "SELECT id, account_id, unit, status FROM investment_purchases WHERE transaction_id = ?",
    [transactionId]
  );

  if (!existing) {
    return applyInvestmentTransaction({
      db,
      transactionId,
      type,
      accountId,
      transferAccountId,
      date,
      unit: null,
      pricePerUnit: null,
    });
  }

  // Baris pembelian tetap hidup kalau transaksinya masih transfer kas -> investasi (akun tujuan boleh
  // pindah), atau pembelian langsung (income di akun investasi itu sendiri).
  let investmentAccountId: string | null = null;
  if (type === "transfer" && transferAccountId != null) {
    const [sourceType, destinationType] = await Promise.all([
      getAccountType(db, accountId),
      getAccountType(db, transferAccountId),
    ]);
    if (sourceType && destinationType && classifyAccountPair(sourceType, destinationType) === "cash-investment") {
      investmentAccountId = transferAccountId;
    }
  } else if (type !== "transfer" && accountId === existing.account_id) {
    investmentAccountId = accountId;
  }

  const unitContribution = investmentAccountId === existing.account_id ? (existing.unit ?? 0) : 0;
  await assertPurchaseEditKeepsUnitsValid(db, existing, unitContribution);

  if (investmentAccountId == null) {
    await db.runAsync("DELETE FROM investment_purchases WHERE id = ?", [existing.id]);
    return { investmentPurchaseIds: [] };
  }

  await db.runAsync("UPDATE investment_purchases SET date = ?, account_id = ? WHERE id = ?", [
    date,
    investmentAccountId,
    existing.id,
  ]);
  return { investmentPurchaseIds: [existing.id] };
}

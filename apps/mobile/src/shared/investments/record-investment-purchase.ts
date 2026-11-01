import type { SQLiteDatabase } from "expo-sqlite";
import { generateId } from "@/lib/database/generate-id";
import { applyInvestmentTransaction } from "./apply-investment-transaction";

export type RecordInvestmentPurchaseInput = {
  db: SQLiteDatabase;
  investmentAccountId: string;
  // null = pembelian langsung tanpa kas (hibah, bonus saham, saldo/unit awal).
  cashAccountId: string | null;
  amount: number;
  unit: number | null;
  pricePerUnit: number | null;
  date: string;
  note: string;
  status: "pending" | "settled";
};

// Semua penulisan dalam satu transaksi SQLite: transaksi tanpa baris investment_purchases
// (atau sebaliknya) tidak boleh pernah tersimpan setengah-setengah.
export async function recordInvestmentPurchase(input: RecordInvestmentPurchaseInput): Promise<string> {
  const { db, investmentAccountId, cashAccountId, amount, unit, pricePerUnit, date, note, status } = input;
  const transactionId = generateId();

  await db.withTransactionAsync(async () => {
    if (cashAccountId != null) {
      await db.runAsync(
        `INSERT INTO transactions
          (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
         VALUES (?, ?, NULL, 'transfer', ?, ?, NULL, ?, ?)`,
        [transactionId, note, amount, date, cashAccountId, investmentAccountId]
      );
      await applyInvestmentTransaction({
        db,
        transactionId,
        type: "transfer",
        accountId: cashAccountId,
        transferAccountId: investmentAccountId,
        date,
        unit,
        pricePerUnit,
        status,
      });
      return;
    }

    // Jalur direct: income pada akun investasi itu sendiri (bukan transfer), lalu baris pembelian
    // di-insert langsung — tidak lewat applyInvestmentTransaction yang eksklusif untuk transfer kas.
    await db.runAsync(
      `INSERT INTO transactions
        (id, note, description, type, amount, date, category_id, account_id, transfer_account_id)
       VALUES (?, ?, NULL, 'income', ?, ?, NULL, ?, NULL)`,
      [transactionId, note, amount, date, investmentAccountId]
    );
    await db.runAsync(
      `INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'settled')`,
      [generateId(), investmentAccountId, transactionId, unit, pricePerUnit, date]
    );
  });

  return transactionId;
}

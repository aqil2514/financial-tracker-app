import type { SQLiteDatabase } from "expo-sqlite";

export type TransactionForexRole = { role: "none" } | { role: "purchase" | "sale" | "forex-account" };

// Dipakai form transaksi umum: transaksi yang lahir dari beli/jual valas (termasuk leg selisih kurs di akun kas) atau
// menyentuh akun valas tidak boleh diedit lewat form umum, karena unit, kurs, dan average cost tersimpan sendiri.
export async function getTransactionForex(db: SQLiteDatabase, transactionId: string): Promise<TransactionForexRole> {
  const purchase = await db.getFirstAsync("SELECT 1 FROM forex_purchases WHERE transaction_id = ?", [transactionId]);
  if (purchase) return { role: "purchase" };

  const sale = await db.getFirstAsync(
    "SELECT 1 FROM forex_sales WHERE transaction_id = ? OR adjustment_transaction_id = ?",
    [transactionId, transactionId]
  );
  if (sale) return { role: "sale" };

  const touchesForexAccount = await db.getFirstAsync(
    `SELECT 1 FROM transactions t
     JOIN accounts a ON a.id = t.account_id OR a.id = t.transfer_account_id
     WHERE t.id = ? AND a.account_type = 'forex'`,
    [transactionId]
  );
  return touchesForexAccount ? { role: "forex-account" } : { role: "none" };
}

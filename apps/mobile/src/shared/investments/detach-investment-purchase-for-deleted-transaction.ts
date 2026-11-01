import type { SQLiteDatabase } from "expo-sqlite";

export type DeletedTransactionInvestmentInfo = { role: "none" } | { role: "purchase"; investmentPurchaseId: string };

// Dipanggil SEBELUM baris transactions di-hard-delete. Beda dari debts: investment_purchases tidak punya baris
// anak dan bukan tumpuan accounts.balance (itu tetap murni dari transactions), jadi barisnya ikut dihapus.
// Tanpa ini FK ON DELETE SET NULL meninggalkan baris yatim yang unitnya masih ikut average cost.
export async function detachInvestmentPurchaseForDeletedTransaction(
  db: SQLiteDatabase,
  transactionId: string
): Promise<DeletedTransactionInvestmentInfo> {
  const row = await db.getFirstAsync<{ id: string }>("SELECT id FROM investment_purchases WHERE transaction_id = ?", [
    transactionId,
  ]);
  if (!row) return { role: "none" };

  await db.runAsync("DELETE FROM investment_purchases WHERE id = ?", [row.id]);
  return { role: "purchase", investmentPurchaseId: row.id };
}

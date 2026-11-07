import type { SQLiteDatabase } from "expo-sqlite";

// Kurs murni informasional: TIDAK membuat transaksi dan TIDAK mengubah saldo akun (konsep-valas.md). updated_at selalu
// maju walau nilainya sama: konfirmasi kurs masih berlaku, dan dipakai sebagai indikator kurs usang.
export async function updateForexRate(db: SQLiteDatabase, accountId: string, currentRate: number) {
  if (!(currentRate > 0)) throw new Error("Kurs harus lebih dari 0.");
  await db.runAsync(`UPDATE forex_accounts SET current_rate = ?, updated_at = datetime('now') WHERE account_id = ?`, [
    currentRate,
    accountId,
  ]);
}

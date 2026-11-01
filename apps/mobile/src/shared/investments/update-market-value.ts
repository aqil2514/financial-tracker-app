import type { SQLiteDatabase } from "expo-sqlite";

// Nilai pasar murni informasional: TIDAK membuat transaksi dan TIDAK mengubah accounts.balance
// (lihat konsep-investasi.md). updated_at selalu maju walau nilainya sama — user mengonfirmasi
// nilai itu masih berlaku hari ini, dan updated_at dipakai sebagai indikator staleness.
export async function updateMarketValue(db: SQLiteDatabase, accountId: string, currentMarketValue: number) {
  await db.runAsync(
    `UPDATE investment_accounts SET current_market_value = ?, updated_at = datetime('now') WHERE account_id = ?`,
    [currentMarketValue, accountId]
  );
}

import type { SQLiteDatabase } from "expo-sqlite";

// updated_at cuma maju kalau unit_label/current_market_value benar-benar berubah
// (dipakai indikator staleness nilai pasar). Di SQLite semua ekspresi SET
// membaca nilai LAMA baris, jadi urutan assignment tidak berpengaruh.
export async function upsertInvestmentAccount(
  db: SQLiteDatabase,
  accountId: string,
  unitLabel: string,
  currentMarketValue: number
) {
  await db.runAsync(
    `INSERT INTO investment_accounts (account_id, unit_label, current_market_value) VALUES (?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       updated_at = CASE
         WHEN unit_label != excluded.unit_label OR current_market_value != excluded.current_market_value
         THEN datetime('now') ELSE updated_at END,
       unit_label = excluded.unit_label,
       current_market_value = excluded.current_market_value`,
    [accountId, unitLabel.trim(), currentMarketValue]
  );
}

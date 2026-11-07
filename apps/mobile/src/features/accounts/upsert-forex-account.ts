import type { SQLiteDatabase } from "expo-sqlite";

// updated_at cuma maju kalau country/currency/kurs benar-benar berubah (dipakai indikator kurs usang).
export async function upsertForexAccount(
  db: SQLiteDatabase,
  accountId: string,
  country: string,
  currency: string,
  currentRate: number
) {
  await db.runAsync(
    `INSERT INTO forex_accounts (account_id, country, currency, current_rate) VALUES (?, ?, ?, ?)
     ON CONFLICT(account_id) DO UPDATE SET
       updated_at = CASE
         WHEN country != excluded.country OR currency != excluded.currency OR current_rate != excluded.current_rate
         THEN datetime('now') ELSE updated_at END,
       country = excluded.country,
       currency = excluded.currency,
       current_rate = excluded.current_rate`,
    [accountId, country.trim(), currency.trim(), currentRate]
  );
}

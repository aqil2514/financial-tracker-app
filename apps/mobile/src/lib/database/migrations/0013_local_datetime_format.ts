import type { SQLiteDatabase } from "expo-sqlite";

// Menyeragamkan format tanggal dengan desktop: "YYYY-MM-DDTHH:mm" waktu lokal (periode: "YYYY-MM-DD").
// Baris lama berformat ISO UTC ("...Z") atau datetime('now') ("YYYY-MM-DD HH:MM:SS", UTC) dikonversi.
const DATETIME_TABLES = [
  "transactions",
  "debts",
  "debt_payments",
  "investment_purchases",
  "investment_sales",
  "third_party_funds",
];

export async function up(db: SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    for (const table of DATETIME_TABLES) {
      await db.execAsync(`
        UPDATE ${table}
        SET date = strftime('%Y-%m-%dT%H:%M', date, 'localtime')
        WHERE date LIKE '%Z' OR date NOT LIKE '%T%';
      `);
    }

    await db.execAsync(`
      UPDATE category_periods
      SET start_date = date(start_date, 'localtime'), end_date = date(end_date, 'localtime')
      WHERE start_date LIKE '%T%' OR end_date LIKE '%T%';
    `);
  });
}

import type { SQLiteDatabase } from "expo-sqlite";

// transactions.is_cash_neutral: dibutuhkan Balance Correction akun
// cash (lihat docs/todos/plan/porting-account-cash.md bagian Balance
// Correction) — 0 = selisih kas fisik riil (ikut cashflow), 1 = koreksi
// administratif (exclude dari cashflow). ADD COLUMN biasa cukup di
// sini (beda dari 0004) karena cuma nambah kolom nullable-default,
// bukan menambah FK baru yang butuh pola copy-and-rename.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    ALTER TABLE transactions ADD COLUMN is_cash_neutral INTEGER NOT NULL DEFAULT 0;
  `);
}

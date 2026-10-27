import type { SQLiteDatabase } from "expo-sqlite";

// accounts, account_groups: lihat docs/todos/plan/porting-account-cash.md
// bagian Keputusan. Skema dasar mengacu ke migrasi desktop 0049, tapi
// SENGAJA tanpa deleted_at (desktop sendiri tidak memakainya, murni
// untuk Worker sync) dan tanpa sync_source (ditunda sampai semua
// porting lokal tipe akun selesai). transactions.account_id /
// transfer_account_id BELUM diberi FK ke accounts(id) — masih
// free-text di form transaksi, menyusul migrasi terpisah seperti pola
// category_id di 0004_transaction_category_fk.ts.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE account_groups (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      initial_balance REAL NOT NULL DEFAULT 0,
      account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
      group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_accounts_group ON accounts(group_id);
  `);
}

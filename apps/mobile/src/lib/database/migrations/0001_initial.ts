import type { SQLiteDatabase } from "expo-sqlite";

export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      note TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category_id TEXT,
      account_id TEXT NOT NULL,
      transfer_account_id TEXT,
      has_attachment INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

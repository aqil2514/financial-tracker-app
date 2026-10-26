import type { SQLiteDatabase } from "expo-sqlite";

// PRAGMA foreign_keys/busy_timeout: lihat migrate.ts.
// transaction_attachments: lihat shared/attachments/README.md.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE transaction_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);
  `);
}

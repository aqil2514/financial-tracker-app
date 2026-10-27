import type { SQLiteDatabase } from "expo-sqlite";

// FK transactions.category_id -> categories(id) yang sengaja ditunda di
// 0003_categories.ts, sekarang dipasang setelah CRUD kategori solid dan
// form transaksi sudah benar-benar pakai categories.id (bukan free-text
// lagi) — lihat porting-category.md bagian Keputusan.
//
// SQLite tidak bisa ALTER TABLE untuk menambah FK ke tabel yang sudah
// ada, jadi pola copy-and-rename: rename transactions lama, buat ulang
// dengan FK, copy data balik, lalu drop yang lama. transaction_attachments
// WAJIB ikut di-rebuild juga (skema kolomnya sendiri tidak berubah) —
// FK-nya REFERENCES transactions(id) menyimpan nama tabel sebagai string
// literal, kalau tidak ikut di-rebuild bakal nunjuk ke "transactions_old"
// yang sudah di-drop di akhir migrasi ini (lihat
// apps/desktop/docs/rules/sqlite-copy-and-rename-migration.md, prinsip
// sama berlaku di mobile).
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    DROP INDEX IF EXISTS idx_transaction_attachments_transaction;

    ALTER TABLE transactions RENAME TO transactions_old;
    ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;

    CREATE TABLE transactions (
      id TEXT PRIMARY KEY NOT NULL,
      note TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      account_id TEXT NOT NULL,
      transfer_account_id TEXT,
      has_attachment INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO transactions (
      id, note, description, type, amount, date, category_id, account_id,
      transfer_account_id, has_attachment, created_at
    )
    SELECT
      id, note, description, type, amount, date, category_id, account_id,
      transfer_account_id, has_attachment, created_at
    FROM transactions_old;

    CREATE TABLE transaction_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT INTO transaction_attachments (id, transaction_id, file_path, created_at)
    SELECT id, transaction_id, file_path, created_at FROM transaction_attachments_old;

    CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

    DROP TABLE transaction_attachments_old;
    DROP TABLE transactions_old;
  `);
}

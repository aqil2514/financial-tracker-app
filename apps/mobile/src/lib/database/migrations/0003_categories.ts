import type { SQLiteDatabase } from "expo-sqlite";

// categories, category_periods, category_period_categories: lihat
// docs/concept/konsep-kategori.md. transactions.category_id BELUM diberi
// FK ke categories(id) — menyusul migrasi terpisah setelah form transaksi
// benar-benar pakai kategori dari tabel ini, bukan free-text.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_categories_parent ON categories(parent_id);

    CREATE TABLE category_periods (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE category_period_categories (
      id TEXT PRIMARY KEY NOT NULL,
      period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (period_id, category_id)
    );

    CREATE INDEX idx_category_period_categories_period ON category_period_categories(period_id);
    CREATE INDEX idx_category_period_categories_category ON category_period_categories(category_id);
  `);
}

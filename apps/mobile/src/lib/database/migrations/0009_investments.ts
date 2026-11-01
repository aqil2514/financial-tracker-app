import type { SQLiteDatabase } from "expo-sqlite";

// investment_accounts, investment_purchases, investment_sales: lihat
// docs/todos/plan/porting-account-investment.md bagian Skema. Mengacu
// ke skema final desktop (migrasi 0035->0043), MINUS deleted_at/
// sync_source (ditunda, sama seperti 0005_accounts dan 0008_debts) dan
// MINUS updated_at di investment_purchases/investment_sales.
// investment_accounts.updated_at TETAP ada karena dipakai fitur bisnis
// (indikator staleness nilai pasar), BUKAN cuma untuk sync — tidak ada
// trigger di mobile, jadi kode update nilai pasar wajib mengisinya
// sendiri.
//
// Modal (cost basis) dan total unit TIDAK disimpan sebagai kolom —
// modal = accounts.balance (dari transaksi), unit selalu dihitung dari
// investment_purchases/investment_sales lewat satu fungsi di shared/
// investments saat ditulis (jangan diduplikasi manual).
//
// Penjualan berstatus 'pending' TIDAK BOLEH membuat transaksi apa pun
// (transaction_id/adjustment_transaction_id NULL, average_cost_per_unit
// dan realized_pl NULL) sampai di-settle.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE investment_accounts (
      account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      unit_label TEXT NOT NULL,
      current_market_value REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE investment_purchases (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      unit REAL,
      price_per_unit REAL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
    CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

    CREATE TABLE investment_sales (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      unit REAL NOT NULL,
      price_per_unit REAL NOT NULL,
      average_cost_per_unit REAL,
      realized_pl REAL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
    CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
    CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);
  `);
}

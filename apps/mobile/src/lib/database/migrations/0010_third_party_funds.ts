import type { SQLiteDatabase } from "expo-sqlite";

// third_party_funds: lihat docs/todos/done/porting-account-third-party.md.
// Mengacu ke skema final desktop (migrasi 0049), MINUS updated_at/
// deleted_at/sync_source (ditunda, sama seperti 0005_accounts, 0008_debts,
// dan 0009_investments). Mobile HARD DELETE, desktop/D1 soft delete.
//
// Tidak ada kolom status: sisa titipan selalu dihitung dari
// SUM(in) - SUM(out) per (account_id, contact_id), jangan disimpan.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE third_party_funds (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_third_party_funds_account ON third_party_funds(account_id);
    CREATE INDEX idx_third_party_funds_contact ON third_party_funds(contact_id);
    CREATE INDEX idx_third_party_funds_transaction ON third_party_funds(transaction_id);
  `);
}

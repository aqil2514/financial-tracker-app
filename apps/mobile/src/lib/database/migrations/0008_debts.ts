import type { SQLiteDatabase } from "expo-sqlite";

// debt_accounts, contacts, debts, debt_payments: lihat
// docs/todos/plan/porting-account-debt.md bagian Skema. Mengacu ke
// skema final desktop (migrasi 0012->0053), MINUS updated_at/
// deleted_at/sync_source (ditunda, sama seperti 0005_accounts) dan
// MINUS source/source_ref (integrasi Retailku, tidak relevan di
// mobile) beserta unique index source_ref-nya.
//
// direction/type di sini TIDAK PERNAH punya opsi 'both' — opsi itu
// sempat ada di desktop lalu sengaja dihapus (migrasi 0051 desktop),
// konsisten dengan konsep satu akun = satu arah murni.
//
// remaining (sisa belum lunas) TIDAK disimpan sebagai kolom — selalu
// dihitung `amount - COALESCE(SUM(debt_payments.amount), 0)` lewat
// satu fragment SQL tunggal (lihat remaining-debt-sql di shared/debts
// saat ditulis), jangan diduplikasi manual di banyak tempat.
export async function up(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE debt_accounts (
      account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable'))
    );

    CREATE TABLE contacts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_contacts_name ON contacts(name);

    CREATE TABLE debts (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
      contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      amount REAL NOT NULL,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_debts_contact_id ON debts(contact_id);
    CREATE INDEX idx_debts_status ON debts(status);

    CREATE TABLE debt_payments (
      id TEXT PRIMARY KEY NOT NULL,
      debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
      transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
  `);
}

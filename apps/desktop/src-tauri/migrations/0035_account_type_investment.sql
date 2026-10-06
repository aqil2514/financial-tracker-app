-- Tambah 'investment' ke CHECK constraint `accounts.account_type` --
-- langkah 1 dari apps/desktop/docs/todos/plan/account-type-investment.md,
-- model data lengkap di docs/concept/konsep-investasi.md.
--
-- SQLite tidak izinkan ALTER CHECK (lihat
-- docs/rules/sqlite-copy-and-rename-migration.md). `accounts`
-- DIREFERENSIKAN FK oleh transactions, debts, debt_payments, dan
-- retailku_sync_field_mapping -- SEMUA ikut di-rebuild di migrasi ini
-- walau skema kolomnya sendiri tidak berubah (wajib, lihat rule poin
-- #3: FK tabel lain menyimpan nama tabel target sebagai string literal,
-- tidak ikut RENAME). transaction_attachments ikut juga karena FK ke
-- transactions yang ikut di-rebuild.
--
-- Skema disalin APA ADANYA dari kondisi final pasca 0015 (color), 0025/
-- 0026 (source/source_ref di debts/debt_payments), dan 0028 (updated_at/
-- deleted_at/sync_source + trigger) -- HANYA accounts.account_type CHECK
-- yang berubah.

-- ============================================================
-- 0. Drop trigger & index lama dulu (trigger tidak ikut ter-drop
-- otomatis saat tabel di-rename, dan nama index dipakai ulang di bawah).
-- ============================================================

DROP TRIGGER IF EXISTS trg_accounts_updated_at;
DROP TRIGGER IF EXISTS trg_transactions_updated_at;
DROP TRIGGER IF EXISTS trg_debts_updated_at;
DROP TRIGGER IF EXISTS trg_debt_payments_updated_at;

DROP INDEX IF EXISTS idx_accounts_group;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_account;
DROP INDEX IF EXISTS idx_transactions_transfer_account;
DROP INDEX IF EXISTS idx_transactions_contact_id;
DROP INDEX IF EXISTS idx_transactions_source_ref;
DROP INDEX IF EXISTS idx_transaction_attachments_transaction;
DROP INDEX IF EXISTS idx_debts_contact_id;
DROP INDEX IF EXISTS idx_debts_status;
DROP INDEX IF EXISTS idx_debts_source_ref;
DROP INDEX IF EXISTS idx_debt_payments_debt;
DROP INDEX IF EXISTS idx_debt_payments_source_ref;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_local_account;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_category;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_secondary_account;

-- ============================================================
-- 1. Rename semua tabel yang terlibat (yang berubah MAUPUN yang
-- FK-nya menunjuk ke tabel yang berubah).
-- ============================================================

ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;
ALTER TABLE retailku_sync_field_mapping RENAME TO retailku_sync_field_mapping_old;

-- ============================================================
-- 2. Buat semua tabel baru (nama asli) + copy data, urut dependency FK.
-- ============================================================

-- 2.1 accounts -- SATU-SATUNYA perubahan skema: 'investment' di CHECK.
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment')),
    color TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO accounts (id, name, icon, initial_balance, created_at, group_id, description, is_active, account_type, color, updated_at, deleted_at, sync_source)
    SELECT id, name, icon, initial_balance, created_at, group_id, description, is_active, account_type, color, updated_at, deleted_at, sync_source
    FROM accounts_old;
CREATE INDEX idx_accounts_group ON accounts(group_id);

CREATE TRIGGER trg_accounts_updated_at
AFTER UPDATE ON accounts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE accounts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.2 transactions -- skema identik, cuma FK target accounts diperbaiki.
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transfer_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at, description, contact_id, source, source_ref, updated_at, deleted_at, sync_source)
    SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at, description, contact_id, source, source_ref, updated_at, deleted_at, sync_source
    FROM transactions_old;
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;

CREATE TRIGGER trg_transactions_updated_at
AFTER UPDATE ON transactions
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.3 transaction_attachments -- skema identik, FK ke transactions saja.
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO transaction_attachments (id, transaction_id, file_path, created_at)
    SELECT id, transaction_id, file_path, created_at FROM transaction_attachments_old;
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

-- 2.4 debts -- skema identik, FK ke contacts/accounts/transactions.
CREATE TABLE debts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, status, note, date, created_at, source, source_ref, updated_at, deleted_at, sync_source)
    SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date, created_at, source, source_ref, updated_at, deleted_at, sync_source
    FROM debts_old;
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE UNIQUE INDEX idx_debts_source_ref
    ON debts(source, source_ref)
    WHERE source_ref IS NOT NULL;

CREATE TRIGGER trg_debts_updated_at
AFTER UPDATE ON debts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE debts SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.5 debt_payments -- skema identik, FK ke debts/accounts/transactions.
CREATE TABLE debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, note, date, created_at, source, source_ref, updated_at, deleted_at, sync_source)
    SELECT id, debt_id, amount, account_id, transaction_id, note, date, created_at, source, source_ref, updated_at, deleted_at, sync_source
    FROM debt_payments_old;
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE UNIQUE INDEX idx_debt_payments_source_ref
    ON debt_payments(source, source_ref)
    WHERE source_ref IS NOT NULL;

CREATE TRIGGER trg_debt_payments_updated_at
AFTER UPDATE ON debt_payments
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE debt_payments SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.6 retailku_sync_field_mapping -- skema identik, FK ke accounts (x2) & categories.
CREATE TABLE retailku_sync_field_mapping (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    retailku_account_id TEXT NOT NULL,
    retailku_account_code TEXT NOT NULL,
    retailku_account_name TEXT NOT NULL,
    local_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    note TEXT,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    secondary_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    source_kind TEXT NOT NULL DEFAULT 'generic',
    extra_fields TEXT
);
INSERT INTO retailku_sync_field_mapping (
    id, key, retailku_account_id, retailku_account_code, retailku_account_name,
    local_account_id, note, category_id, description, created_at, updated_at,
    secondary_account_id, source_kind, extra_fields
)
    SELECT
        id, key, retailku_account_id, retailku_account_code, retailku_account_name,
        local_account_id, note, category_id, description, created_at, updated_at,
        secondary_account_id, source_kind, extra_fields
    FROM retailku_sync_field_mapping_old;
CREATE INDEX idx_retailku_sync_field_mapping_local_account
    ON retailku_sync_field_mapping(local_account_id);
CREATE INDEX idx_retailku_sync_field_mapping_category
    ON retailku_sync_field_mapping(category_id);
CREATE INDEX idx_retailku_sync_field_mapping_secondary_account
    ON retailku_sync_field_mapping(secondary_account_id);

-- ============================================================
-- 3. Drop semua tabel lama di akhir.
-- ============================================================

DROP TABLE retailku_sync_field_mapping_old;
DROP TABLE debt_payments_old;
DROP TABLE debts_old;
DROP TABLE transaction_attachments_old;
DROP TABLE transactions_old;
DROP TABLE accounts_old;

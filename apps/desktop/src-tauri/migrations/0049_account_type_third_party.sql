-- Tambah 'third_party' ke CHECK constraint `accounts.account_type` +
-- tabel detail `third_party_funds` -- langkah 1 dari
-- apps/desktop/docs/todos/plan/account-type-third-party.md, model data
-- lengkap di docs/concept/konsep-dana-pihak-ketiga.md.
--
-- SQLite tidak izinkan ALTER CHECK (lihat
-- docs/rules/sqlite-copy-and-rename-migration.md). `accounts`
-- DIREFERENSIKAN FK oleh: transactions, debts, debt_payments,
-- retailku_sync_field_mapping (sejak 0035), DAN investment_accounts,
-- investment_purchases, investment_sales, account_labels (dibuat
-- SETELAH 0035, belum pernah ikut rebuild manapun) -- SEMUA 8 tabel
-- ini ikut di-rebuild di sini walau skema kolomnya sendiri tidak
-- berubah. transaction_attachments dan transaction_labels ikut juga
-- karena FK-nya menunjuk ke transactions (yang ikut di-rebuild), bukan
-- langsung ke accounts -- rantai transitif, lihat rule poin #3.
--
-- Skema disalin APA ADANYA dari kondisi final pasca 0042 (kolom cloud
-- sync investment_*), 0041 (investment_sales nullable realized_pl/
-- average_cost_per_unit + adjustment_transaction_id), 0038 (investment_
-- purchases nullable unit/price_per_unit), 0037 (investment_accounts
-- current_market_value), dan 0045 (account_labels) -- HANYA
-- accounts.account_type CHECK yang berubah + tabel baru third_party_funds.
--
-- third_party_funds BELUM diputuskan perlu kolom `status` (lunas/
-- berjalan) -- condong TIDAK, sisa titipan dihitung ulang dari SUM
-- `direction='in'` - SUM `direction='out'` per (account_id, contact_id).
-- `direction` (bukan `type` seperti debts.type) karena transfer
-- third_party->third_party (lihat konsep, "Pindah tempat dan/atau
-- pindah kepemilikan") menghasilkan DUA baris per transaksi (satu 'out'
-- di kontak+akun asal, satu 'in' di kontak+akun tujuan) -- tidak bisa
-- hanya mengandalkan transactions.type karena satu transfer perlu dua
-- kontak independen. contact_id NOT NULL (beda dari debts.contact_id
-- yang nullable) karena konsep mewajibkan kontak diisi untuk titip/ambil
-- (mirror cash -> debt di konsep-utang-piutang.md).

-- ============================================================
-- 0. Drop trigger & index lama dulu.
-- ============================================================

DROP TRIGGER IF EXISTS trg_accounts_updated_at;
DROP TRIGGER IF EXISTS trg_transactions_updated_at;
DROP TRIGGER IF EXISTS trg_debts_updated_at;
DROP TRIGGER IF EXISTS trg_debt_payments_updated_at;
DROP TRIGGER IF EXISTS trg_investment_accounts_updated_at;
DROP TRIGGER IF EXISTS trg_investment_purchases_updated_at;
DROP TRIGGER IF EXISTS trg_investment_sales_updated_at;
DROP TRIGGER IF EXISTS trg_account_labels_updated_at;
DROP TRIGGER IF EXISTS trg_transaction_labels_updated_at;

DROP INDEX IF EXISTS idx_accounts_group;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_account;
DROP INDEX IF EXISTS idx_transactions_transfer_account;
DROP INDEX IF EXISTS idx_transactions_contact_id;
DROP INDEX IF EXISTS idx_transactions_source_ref;
DROP INDEX IF EXISTS idx_transaction_attachments_transaction;
DROP INDEX IF EXISTS idx_transaction_labels_transaction;
DROP INDEX IF EXISTS idx_transaction_labels_label;
DROP INDEX IF EXISTS idx_debts_contact_id;
DROP INDEX IF EXISTS idx_debts_status;
DROP INDEX IF EXISTS idx_debts_source_ref;
DROP INDEX IF EXISTS idx_debt_payments_debt;
DROP INDEX IF EXISTS idx_debt_payments_source_ref;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_local_account;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_category;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_secondary_account;
DROP INDEX IF EXISTS idx_investment_purchases_account;
DROP INDEX IF EXISTS idx_investment_purchases_transaction;
DROP INDEX IF EXISTS idx_investment_sales_account;
DROP INDEX IF EXISTS idx_investment_sales_transaction;
DROP INDEX IF EXISTS idx_investment_sales_adjustment_transaction;
DROP INDEX IF EXISTS idx_account_labels_account;
DROP INDEX IF EXISTS idx_account_labels_label;

-- ============================================================
-- 1. Rename semua tabel yang terlibat.
-- ============================================================

ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;
ALTER TABLE transaction_labels RENAME TO transaction_labels_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;
ALTER TABLE retailku_sync_field_mapping RENAME TO retailku_sync_field_mapping_old;
ALTER TABLE investment_accounts RENAME TO investment_accounts_old;
ALTER TABLE investment_purchases RENAME TO investment_purchases_old;
ALTER TABLE investment_sales RENAME TO investment_sales_old;
ALTER TABLE account_labels RENAME TO account_labels_old;

-- ============================================================
-- 2. Buat semua tabel baru (nama asli) + copy data, urut dependency FK.
-- ============================================================

-- 2.1 accounts -- SATU-SATUNYA perubahan skema: 'third_party' di CHECK.
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
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

-- 2.2 transactions -- skema identik, FK target accounts diperbaiki.
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

-- 2.4 transaction_labels -- skema identik, FK ke transactions (+ labels,
-- tidak ikut rebuild karena labels sendiri tidak FK ke accounts).
CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (transaction_id, label_id)
);
INSERT INTO transaction_labels (id, transaction_id, label_id, created_at, updated_at, deleted_at, sync_source)
    SELECT id, transaction_id, label_id, created_at, updated_at, deleted_at, sync_source
    FROM transaction_labels_old;
CREATE INDEX idx_transaction_labels_transaction ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);

CREATE TRIGGER trg_transaction_labels_updated_at
AFTER UPDATE ON transaction_labels
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE transaction_labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.5 debts -- skema identik, FK ke contacts/accounts/transactions.
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

-- 2.6 debt_payments -- skema identik, FK ke debts/accounts/transactions.
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

-- 2.7 retailku_sync_field_mapping -- skema identik, FK ke accounts (x2) & categories.
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

-- 2.8 investment_accounts -- skema identik, FK ke accounts saja.
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO investment_accounts (account_id, unit_label, current_market_value, updated_at, deleted_at, sync_source)
    SELECT account_id, unit_label, current_market_value, updated_at, deleted_at, sync_source
    FROM investment_accounts_old;

CREATE TRIGGER trg_investment_accounts_updated_at
AFTER UPDATE ON investment_accounts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE investment_accounts SET updated_at = datetime('now') WHERE account_id = NEW.account_id;
END;

-- 2.9 investment_purchases -- skema identik, FK ke accounts/transactions.
CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, deleted_at, sync_source)
    SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, deleted_at, sync_source
    FROM investment_purchases_old;
CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

CREATE TRIGGER trg_investment_purchases_updated_at
AFTER UPDATE ON investment_purchases
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE investment_purchases SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.10 investment_sales -- skema identik, FK ke accounts/transactions (x2).
CREATE TABLE investment_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    average_cost_per_unit REAL,
    realized_pl REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO investment_sales (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, created_at, updated_at, deleted_at, sync_source)
    SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, created_at, updated_at, deleted_at, sync_source
    FROM investment_sales_old;
CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);

CREATE TRIGGER trg_investment_sales_updated_at
AFTER UPDATE ON investment_sales
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE investment_sales SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2.11 account_labels -- skema identik, FK ke accounts (+ labels, tidak
-- ikut rebuild karena labels sendiri tidak FK ke accounts).
CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (account_id, label_id)
);
INSERT INTO account_labels (id, account_id, label_id, created_at, updated_at, deleted_at, sync_source)
    SELECT id, account_id, label_id, created_at, updated_at, deleted_at, sync_source
    FROM account_labels_old;
CREATE INDEX idx_account_labels_account ON account_labels(account_id);
CREATE INDEX idx_account_labels_label ON account_labels(label_id);

CREATE TRIGGER trg_account_labels_updated_at
AFTER UPDATE ON account_labels
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE account_labels SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- 3. Drop semua tabel lama di akhir.
-- ============================================================

DROP TABLE account_labels_old;
DROP TABLE investment_sales_old;
DROP TABLE investment_purchases_old;
DROP TABLE investment_accounts_old;
DROP TABLE retailku_sync_field_mapping_old;
DROP TABLE debt_payments_old;
DROP TABLE debts_old;
DROP TABLE transaction_labels_old;
DROP TABLE transaction_attachments_old;
DROP TABLE transactions_old;
DROP TABLE accounts_old;

-- ============================================================
-- 4. Tabel baru: third_party_funds -- riwayat titip/ambil/pindah per
-- (akun, kontak), reuse pola contact_id persis debts (lihat
-- docs/concept/konsep-dana-pihak-ketiga.md). Tabel baru murni, tidak
-- direferensikan tabel lain -- tidak perlu copy-and-rename.
-- ============================================================

CREATE TABLE third_party_funds (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_third_party_funds_account ON third_party_funds(account_id);
CREATE INDEX idx_third_party_funds_contact ON third_party_funds(contact_id);
CREATE INDEX idx_third_party_funds_transaction ON third_party_funds(transaction_id);

CREATE TRIGGER trg_third_party_funds_updated_at
AFTER UPDATE ON third_party_funds
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE third_party_funds SET updated_at = datetime('now') WHERE id = NEW.id;
END;

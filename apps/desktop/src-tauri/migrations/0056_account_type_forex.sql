-- Tambah 'forex' ke CHECK constraint `accounts.account_type` -- langkah 1
-- dari apps/desktop/docs/todos/plan/account-type-forex.md, konsep di
-- docs/concept/konsep-valas.md. Tabel detail valas ada di migrasi 0057.
--
-- SQLite tidak izinkan ALTER CHECK (lihat
-- docs/rules/sqlite-copy-and-rename-migration.md). Semua tabel yang FK-nya
-- menunjuk ke `accounts` ikut di-rebuild di sini walau skema kolomnya tidak
-- berubah: transactions, debts, debt_payments, retailku_sync_field_mapping,
-- investment_accounts, investment_purchases, investment_sales,
-- account_labels, debt_accounts, third_party_funds. Tabel yang FK-nya
-- menunjuk ke transactions/debts (yang ikut di-rebuild) juga ikut:
-- transaction_attachments, transaction_labels, debt_amount_adjustments --
-- rantai transitif, lihat rule poin #3.
--
-- Beda dari 0049: tiga tabel dibuat SETELAH 0049 dan ikut di-rebuild
-- sekarang -- debt_accounts (0050/0051), debt_amount_adjustments (0053),
-- dan third_party_funds (dibuat di 0049 sendiri, baru kini perlu rebuild
-- karena FK-nya ke accounts/transactions). Kolom
-- transactions.is_cash_neutral (0052) juga ikut disalin.
--
-- Skema disalin APA ADANYA dari kondisi final pasca 0055 -- HANYA
-- accounts.account_type CHECK yang berubah.

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
DROP TRIGGER IF EXISTS trg_third_party_funds_updated_at;

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
DROP INDEX IF EXISTS idx_debt_amount_adjustments_debt;
DROP INDEX IF EXISTS idx_debt_amount_adjustments_transaction;
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
DROP INDEX IF EXISTS idx_third_party_funds_account;
DROP INDEX IF EXISTS idx_third_party_funds_contact;
DROP INDEX IF EXISTS idx_third_party_funds_transaction;

-- ============================================================
-- 1. Rename semua tabel yang terlibat.
-- ============================================================

ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;
ALTER TABLE transaction_labels RENAME TO transaction_labels_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;
ALTER TABLE debt_amount_adjustments RENAME TO debt_amount_adjustments_old;
ALTER TABLE retailku_sync_field_mapping RENAME TO retailku_sync_field_mapping_old;
ALTER TABLE investment_accounts RENAME TO investment_accounts_old;
ALTER TABLE investment_purchases RENAME TO investment_purchases_old;
ALTER TABLE investment_sales RENAME TO investment_sales_old;
ALTER TABLE account_labels RENAME TO account_labels_old;
ALTER TABLE debt_accounts RENAME TO debt_accounts_old;
ALTER TABLE third_party_funds RENAME TO third_party_funds_old;

-- ============================================================
-- 2. Buat semua tabel baru (nama asli) + copy data, urut dependency FK.
-- ============================================================

-- 2.1 accounts -- SATU-SATUNYA perubahan skema: 'forex' di CHECK.
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party', 'forex')),
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

-- 2.2 transactions -- skema identik (termasuk is_cash_neutral dari 0052).
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
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    is_cash_neutral INTEGER NOT NULL DEFAULT 0
);
INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at, description, contact_id, source, source_ref, updated_at, deleted_at, sync_source, is_cash_neutral)
    SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at, description, contact_id, source, source_ref, updated_at, deleted_at, sync_source, is_cash_neutral
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

-- 2.3 transaction_attachments -- skema identik.
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO transaction_attachments (id, transaction_id, file_path, created_at)
    SELECT id, transaction_id, file_path, created_at FROM transaction_attachments_old;
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

-- 2.4 transaction_labels -- skema identik.
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

-- 2.5 debts -- skema identik.
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

-- 2.6 debt_payments -- skema identik.
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

-- 2.7 debt_amount_adjustments -- skema identik (dibuat 0053, tanpa trigger).
CREATE TABLE debt_amount_adjustments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    delta REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO debt_amount_adjustments (id, debt_id, transaction_id, delta, date, created_at)
    SELECT id, debt_id, transaction_id, delta, date, created_at
    FROM debt_amount_adjustments_old;
CREATE INDEX idx_debt_amount_adjustments_debt ON debt_amount_adjustments(debt_id);
CREATE INDEX idx_debt_amount_adjustments_transaction ON debt_amount_adjustments(transaction_id);

-- 2.8 retailku_sync_field_mapping -- skema identik.
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

-- 2.9 investment_accounts -- skema identik.
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

-- 2.10 investment_purchases -- skema identik.
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

-- 2.11 investment_sales -- skema identik.
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

-- 2.12 account_labels -- skema identik.
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

-- 2.13 debt_accounts -- skema identik (kondisi final 0051).
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable'))
);
INSERT INTO debt_accounts (account_id, direction)
    SELECT account_id, direction FROM debt_accounts_old;

-- 2.14 third_party_funds -- skema identik (dibuat 0049).
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
INSERT INTO third_party_funds (id, account_id, contact_id, transaction_id, direction, amount, date, note, created_at, updated_at, deleted_at, sync_source)
    SELECT id, account_id, contact_id, transaction_id, direction, amount, date, note, created_at, updated_at, deleted_at, sync_source
    FROM third_party_funds_old;
CREATE INDEX idx_third_party_funds_account ON third_party_funds(account_id);
CREATE INDEX idx_third_party_funds_contact ON third_party_funds(contact_id);
CREATE INDEX idx_third_party_funds_transaction ON third_party_funds(transaction_id);

CREATE TRIGGER trg_third_party_funds_updated_at
AFTER UPDATE ON third_party_funds
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE third_party_funds SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================
-- 3. Drop semua tabel lama di akhir (anak dulu, induk belakangan).
-- ============================================================

DROP TABLE third_party_funds_old;
DROP TABLE debt_accounts_old;
DROP TABLE account_labels_old;
DROP TABLE investment_sales_old;
DROP TABLE investment_purchases_old;
DROP TABLE investment_accounts_old;
DROP TABLE retailku_sync_field_mapping_old;
DROP TABLE debt_amount_adjustments_old;
DROP TABLE debt_payments_old;
DROP TABLE debts_old;
DROP TABLE transaction_labels_old;
DROP TABLE transaction_attachments_old;
DROP TABLE transactions_old;
DROP TABLE accounts_old;

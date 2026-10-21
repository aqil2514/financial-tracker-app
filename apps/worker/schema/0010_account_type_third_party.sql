-- Tambah 'third_party' ke CHECK constraint `accounts.account_type` +
-- tabel baru `third_party_funds` -- Tahap 1 dari
-- docs/todos/plan/third-party-sync.md. Keputusan scope (Tahap 0, sama
-- dokumen): logic bisnis dana pihak ketiga (validasi oversell titip/
-- ambil, transfer third_party->third_party) direplikasi PENUH ke
-- Worker (modul third-party-funds/ terpisah, Tahap 2) -- migrasi ini
-- BARU skema, bukan logic.
--
-- D1 tidak support ALTER TABLE ... ADD CONSTRAINT atau ALTER COLUMN
-- utk CHECK (sama seperti SQLite biasa) -- `accounts` DIREFERENSIKAN
-- FK oleh: transactions, debts, debt_payments, investment_accounts,
-- investment_purchases, investment_sales, debt_accounts, account_labels
-- -- SEMUA 8 tabel ini ikut di-rebuild di sini walau skema kolomnya
-- sendiri tidak berubah (pola copy-and-rename sama persis migrasi
-- desktop 0049_account_type_third_party.sql DAN migrasi Worker
-- 0002_account_type_investment.sql). transaction_attachments,
-- transaction_labels, dan debt_amount_adjustments ikut juga karena
-- FK-nya menunjuk ke transactions/debts (yang ikut di-rebuild), bukan
-- langsung ke accounts.
--
-- Skema disalin APA ADANYA dari kondisi final pasca 0009 (checksum
-- attachment dari 0004, is_cash_neutral dari 0008, debt_amount_
-- adjustments dari 0009) -- HANYA accounts.account_type CHECK yang
-- berubah + tabel baru third_party_funds.
--
-- third_party_funds di sini SUDAH menyertakan updated_at/deleted_at/
-- sync_source dari awal (beda dari migrasi desktop 0049 yang juga
-- sudah menyertakan kolom ini -- desktop third_party_funds TIDAK
-- perlu migrasi cloud-sync-columns terpisah seperti investment dulu,
-- lihat Tahap 3 third-party-sync.md). BEDA utama dari skema desktop:
-- Worker soft-delete (UPDATE deleted_at, bukan hard DELETE) -- jadi
-- detachThirdPartyFundsForDeletedTransaction versi Worker nanti (Tahap
-- 2) WAJIB set deleted_at, bukan DELETE FROM seperti versi desktop.

-- ============================================================
-- 0. Drop index lama dulu (nama dipakai ulang di bawah).
-- ============================================================

DROP INDEX IF EXISTS idx_accounts_group;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_account;
DROP INDEX IF EXISTS idx_transactions_transfer_account;
DROP INDEX IF EXISTS idx_transactions_contact_id;
DROP INDEX IF EXISTS idx_transactions_source_ref;
DROP INDEX IF EXISTS idx_debts_contact_id;
DROP INDEX IF EXISTS idx_debts_status;
DROP INDEX IF EXISTS idx_debts_source_ref;
DROP INDEX IF EXISTS idx_debt_payments_debt;
DROP INDEX IF EXISTS idx_debt_payments_source_ref;
DROP INDEX IF EXISTS idx_investment_purchases_account;
DROP INDEX IF EXISTS idx_investment_purchases_transaction;
DROP INDEX IF EXISTS idx_investment_sales_account;
DROP INDEX IF EXISTS idx_investment_sales_transaction;
DROP INDEX IF EXISTS idx_investment_sales_adjustment_transaction;
DROP INDEX IF EXISTS idx_transaction_attachments_transaction;
DROP INDEX IF EXISTS idx_transaction_attachments_r2_key;
DROP INDEX IF EXISTS idx_transaction_labels_transaction;
DROP INDEX IF EXISTS idx_transaction_labels_label;
DROP INDEX IF EXISTS idx_account_labels_account;
DROP INDEX IF EXISTS idx_account_labels_label;
DROP INDEX IF EXISTS idx_debt_amount_adjustments_debt;
DROP INDEX IF EXISTS idx_debt_amount_adjustments_transaction;

-- ============================================================
-- 1. Rename semua tabel yang terlibat.
-- ============================================================

ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;
ALTER TABLE investment_accounts RENAME TO investment_accounts_old;
ALTER TABLE investment_purchases RENAME TO investment_purchases_old;
ALTER TABLE investment_sales RENAME TO investment_sales_old;
ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;
ALTER TABLE transaction_labels RENAME TO transaction_labels_old;
ALTER TABLE account_labels RENAME TO account_labels_old;
ALTER TABLE debt_accounts RENAME TO debt_accounts_old;
ALTER TABLE debt_amount_adjustments RENAME TO debt_amount_adjustments_old;

-- ============================================================
-- 2. Buat semua tabel baru (nama asli) + copy data, urut dependency FK.
-- ============================================================

-- 2.1 accounts -- SATU-SATUNYA perubahan skema: 'third_party' di CHECK.
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO accounts (id, name, icon, initial_balance, group_id, description, is_active, account_type, color, created_at, updated_at, deleted_at, sync_source)
    SELECT id, name, icon, initial_balance, group_id, description, is_active, account_type, color, created_at, updated_at, deleted_at, sync_source
    FROM accounts_old;
CREATE INDEX idx_accounts_group ON accounts(group_id);

-- 2.2 transactions -- skema identik (termasuk is_cash_neutral dari
-- 0008), cuma FK target accounts diperbaiki.
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transfer_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    is_cash_neutral INTEGER NOT NULL DEFAULT 0
);
INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, date, description, contact_id, source, source_ref, created_at, updated_at, deleted_at, sync_source, is_cash_neutral)
    SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, description, contact_id, source, source_ref, created_at, updated_at, deleted_at, sync_source, is_cash_neutral
    FROM transactions_old;
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;

-- 2.3 debts -- skema identik, FK ke contacts/accounts/transactions.
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
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, status, note, date, source, source_ref, created_at, updated_at, deleted_at, sync_source)
    SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date, source, source_ref, created_at, updated_at, deleted_at, sync_source
    FROM debts_old;
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE UNIQUE INDEX idx_debts_source_ref
    ON debts(source, source_ref)
    WHERE source_ref IS NOT NULL;

-- 2.4 debt_payments -- skema identik, FK ke debts/accounts/transactions.
CREATE TABLE debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    note TEXT,
    date TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, created_at, updated_at, deleted_at, sync_source)
    SELECT id, debt_id, amount, account_id, transaction_id, note, date, source, source_ref, created_at, updated_at, deleted_at, sync_source
    FROM debt_payments_old;
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE UNIQUE INDEX idx_debt_payments_source_ref
    ON debt_payments(source, source_ref)
    WHERE source_ref IS NOT NULL;

-- 2.5 investment_accounts -- skema identik, FK ke accounts saja.
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO investment_accounts (account_id, unit_label, current_market_value, created_at, updated_at, deleted_at, sync_source)
    SELECT account_id, unit_label, current_market_value, created_at, updated_at, deleted_at, sync_source
    FROM investment_accounts_old;

-- 2.6 investment_purchases -- skema identik, FK ke accounts/transactions.
CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO investment_purchases (id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, deleted_at, sync_source)
    SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, created_at, updated_at, deleted_at, sync_source
    FROM investment_purchases_old;
CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

-- 2.7 investment_sales -- skema identik, FK ke accounts/transactions (x2).
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
    created_at TEXT NOT NULL,
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

-- 2.8 transaction_attachments -- skema identik (termasuk checksum_sha256
-- dari 0004), FK ke transactions saja.
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    r2_key TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    checksum_sha256 TEXT
);
INSERT INTO transaction_attachments (id, transaction_id, r2_key, content_type, size_bytes, created_at, updated_at, deleted_at, sync_source, checksum_sha256)
    SELECT id, transaction_id, r2_key, content_type, size_bytes, created_at, updated_at, deleted_at, sync_source, checksum_sha256
    FROM transaction_attachments_old;
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);
CREATE UNIQUE INDEX idx_transaction_attachments_r2_key ON transaction_attachments(r2_key);

-- 2.9 transaction_labels -- skema identik, FK ke transactions (+ labels,
-- tidak ikut rebuild karena labels sendiri tidak FK ke accounts).
CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (transaction_id, label_id)
);
INSERT INTO transaction_labels (id, transaction_id, label_id, created_at, updated_at, deleted_at, sync_source)
    SELECT id, transaction_id, label_id, created_at, updated_at, deleted_at, sync_source
    FROM transaction_labels_old;
CREATE INDEX idx_transaction_labels_transaction ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);

-- 2.10 account_labels -- skema identik, FK ke accounts (+ labels, tidak
-- ikut rebuild karena labels sendiri tidak FK ke accounts).
CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (account_id, label_id)
);
INSERT INTO account_labels (id, account_id, label_id, created_at, updated_at, deleted_at, sync_source)
    SELECT id, account_id, label_id, created_at, updated_at, deleted_at, sync_source
    FROM account_labels_old;
CREATE INDEX idx_account_labels_account ON account_labels(account_id);
CREATE INDEX idx_account_labels_label ON account_labels(label_id);

-- 2.11 debt_accounts -- skema identik, FK ke accounts saja.
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO debt_accounts (account_id, direction, created_at, updated_at, deleted_at, sync_source)
    SELECT account_id, direction, created_at, updated_at, deleted_at, sync_source
    FROM debt_accounts_old;

-- 2.12 debt_amount_adjustments -- skema identik, FK ke debts/transactions.
CREATE TABLE debt_amount_adjustments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    delta REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'manual'
);
INSERT INTO debt_amount_adjustments (id, debt_id, transaction_id, delta, date, created_at, updated_at, deleted_at, sync_source)
    SELECT id, debt_id, transaction_id, delta, date, created_at, updated_at, deleted_at, sync_source
    FROM debt_amount_adjustments_old;
CREATE INDEX idx_debt_amount_adjustments_debt ON debt_amount_adjustments(debt_id);
CREATE INDEX idx_debt_amount_adjustments_transaction ON debt_amount_adjustments(transaction_id);

-- ============================================================
-- 3. Drop semua tabel lama.
-- ============================================================

DROP TABLE debt_amount_adjustments_old;
DROP TABLE debt_accounts_old;
DROP TABLE account_labels_old;
DROP TABLE transaction_labels_old;
DROP TABLE transaction_attachments_old;
DROP TABLE investment_sales_old;
DROP TABLE investment_purchases_old;
DROP TABLE investment_accounts_old;
DROP TABLE debt_payments_old;
DROP TABLE debts_old;
DROP TABLE transactions_old;
DROP TABLE accounts_old;

-- ============================================================
-- 4. Tabel baru: third_party_funds -- riwayat titip/ambil/pindah per
-- (akun, kontak), replika skema final desktop (migrasi Tauri 0049)
-- DITAMBAH kolom LWW standar (yang di desktop SUDAH ada sejak awal di
-- migrasi 0049, jadi di sini TIDAK beda -- semua tabel Worker sejak
-- 0001_initial.sql sudah konsisten punya updated_at/deleted_at/
-- sync_source langsung). Tabel baru murni, tidak ada data existing --
-- tidak perlu copy-and-rename.
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
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
CREATE INDEX idx_third_party_funds_account ON third_party_funds(account_id);
CREATE INDEX idx_third_party_funds_contact ON third_party_funds(contact_id);
CREATE INDEX idx_third_party_funds_transaction ON third_party_funds(transaction_id);

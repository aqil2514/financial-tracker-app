-- Tambah 'investment' ke CHECK constraint `accounts.account_type` + 3
-- tabel baru (investment_accounts/investment_purchases/investment_sales)
-- -- replika skema final desktop (apps/desktop/src-tauri/migrations
-- 0035-0041), langkah Tahap 1 dari
-- docs/todos/plan/investment-sync.md. Keputusan scope (Tahap 0, sama
-- dokumen): logic bisnis investasi (average cost, Realized P/L, validasi
-- oversell) direplikasi PENUH ke Worker (modul investments/ terpisah,
-- Tahap 2) -- migrasi ini BARU skema, bukan logic.
--
-- D1 tidak support ALTER TABLE ... ADD CONSTRAINT atau ALTER COLUMN utk
-- CHECK (sama seperti SQLite biasa) -- `accounts` direferensikan FK oleh
-- `transactions`/`debts`/`debt_payments`, jadi dipakai pola copy-and-rename
-- sama persis migrasi desktop 0035_account_type_investment.sql: rename
-- SEMUA tabel yg terlibat (yang berubah MAUPUN yang FK-nya menunjuk ke
-- tabel yang berubah), buat ulang, copy data, baru drop yang lama.
--
-- BEDA dari skema investment_* di desktop: 3 tabel baru di sini DITAMBAH
-- updated_at/deleted_at/sync_source (LWW, sama pola 7 tabel yg sudah ada
-- di 0001_initial.sql) -- desktop TIDAK punya kolom ini sama sekali
-- karena belum pernah disentuh sync. Worker SELALU mengisi updated_at
-- eksplisit di tiap tulis (TANPA trigger, sama konvensi 0001_initial.sql)
-- -- desktop PERLU migrasi SENDIRI menambah kolom ini sebelum bisa push
-- (Tahap 3 di docs/todos/plan/investment-sync.md), TIDAK dikerjakan di
-- migrasi ini.

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

-- ============================================================
-- 1. Rename semua tabel yang terlibat.
-- ============================================================

ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;

-- ============================================================
-- 2. Buat semua tabel baru (nama asli) + copy data, urut dependency FK.
-- ============================================================

-- 2.1 accounts -- SATU-SATUNYA perubahan skema: 'investment' di CHECK.
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment')),
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
    description TEXT,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, date, description, contact_id, source, source_ref, created_at, updated_at, deleted_at, sync_source)
    SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, description, contact_id, source, source_ref, created_at, updated_at, deleted_at, sync_source
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

-- ============================================================
-- 3. Drop semua tabel lama.
-- ============================================================

DROP TABLE debt_payments_old;
DROP TABLE debts_old;
DROP TABLE transactions_old;
DROP TABLE accounts_old;

-- ============================================================
-- 4. Tabel baru murni utk tipe akun investment (belum ada data,
-- tidak perlu copy-and-rename) -- skema identik desktop final
-- (migrasi 0036-0041) DITAMBAH updated_at/deleted_at/sync_source.
-- ============================================================

-- investment_accounts -- 1:1 dengan accounts (account_type = 'investment').
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

-- investment_purchases -- riwayat pembelian per lot. unit/price_per_unit
-- nullable (order pending yang belum tahu nilai pasti, lihat desktop
-- migrasi 0038).
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
CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

-- investment_sales -- riwayat penjualan per lot. average_cost_per_unit/
-- realized_pl nullable selama status 'pending' (belum settled, lihat
-- desktop migrasi 0041); adjustment_transaction_id FK eksplisit ke
-- transaksi income/expense kedua di akun kas utk selisih Realized P/L
-- (desktop migrasi 0040).
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
CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);

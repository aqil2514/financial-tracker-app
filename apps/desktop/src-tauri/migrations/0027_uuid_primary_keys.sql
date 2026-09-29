-- Migrasi primary key dari INTEGER AUTOINCREMENT ke UUID v7 (TEXT).
-- Latar belakang lengkap: docs/todos/plan/uuid-migration.md.
--
-- KENAPA: multi-device sync (Turso, direncanakan) akan punya 2+ device
-- menulis OFFLINE bersamaan -- auto-increment lokal per device independen
-- satu sama lain dan BISA TABRAKAN saat sync. UUID v7 dipilih (bukan v4)
-- supaya insert pattern index SQLite tetap "naik" seiring waktu (mirip
-- AUTOINCREMENT lama, index tetap sehat) DAN supaya asumsi "id = urutan
-- waktu" (mis. ORDER BY id DESC) tetap valid tanpa perlu audit ketat.
--
-- SQLite tidak punya fungsi UUID bawaan -- di-generate lewat ekspresi
-- SQL: 48-bit pertama = timestamp ms epoch (printf/CAST dari julianday),
-- grup ketiga diawali '7' (versi v7 fixed), grup keempat diawali
-- salah satu dari 8/9/a/b (variant bit RFC 4122), sisanya randomblob().
-- Diuji manual: 6000 generate berturut-turut (skala ~ tabel transactions)
-- SEMUA unik, format tervalidasi 36 karakter sesuai standar UUID.
--
-- POLA MIGRASI (mengikuti 0009_enforce_fk_set_null.sql & 0022_fix_
-- transactions_old_fk.sql, PENTING #2 di 0009): SEMUA tabel lama di-
-- rename dulu (bukan drop) DAN semua index lama di-drop di awal, baru
-- SEMUA tabel baru dibuat + data disalin (dgn remap FK via kolom
-- `new_id` sementara di tabel lama), baru SEMUA tabel `_old` di-drop di
-- paling akhir. Ini WAJIB -- drop tabel lama di tengah proses akan
-- memicu ON DELETE SET NULL/CASCADE pada FK yang sudah aktif menunjuk
-- ke situ dari tabel baru, meng-NULL-kan/menghapus data yang seharusnya
-- masih valid (bug nyata yang sudah pernah terjadi, lihat 0009).
--
-- Urutan dependency (tabel yang DIREFERENSIKAN duluan dapat UUID
-- duluan, sebelum tabel yang mereferensikannya di-remap):
-- account_groups -> categories (self-ref parent_id) -> contacts ->
-- accounts -> transactions -> transaction_attachments -> debts ->
-- debt_payments -> retailku_sync_field_mapping.
--
-- SEKALIAN (diminta bersamaan): tambah `created_at` ke `categories` --
-- satu-satunya dari 9 tabel scope migrasi ini yang sebelumnya TIDAK
-- punya kolom itu sama sekali (audit 2026-09-30, lihat uuid-migration.md).
-- Baris existing di-backfill `datetime('now')` (waktu migrasi berjalan,
-- BUKAN waktu kategori itu sebenarnya dibuat -- data itu tidak pernah
-- direkam sebelumnya, jadi tidak ada cara mengetahui nilai aslinya).

-- ============================================================
-- 0. Tambah kolom `new_id` (UUID v7) sementara di SEMUA tabel lama --
-- dipakai sbg sumber JOIN utk remap FK saat rebuild di bawah. Kolom
-- ini TIDAK ikut ke skema final, cuma alat bantu migrasi.
-- ============================================================

ALTER TABLE account_groups ADD COLUMN new_id TEXT;
ALTER TABLE categories ADD COLUMN new_id TEXT;
ALTER TABLE contacts ADD COLUMN new_id TEXT;
ALTER TABLE accounts ADD COLUMN new_id TEXT;
ALTER TABLE transactions ADD COLUMN new_id TEXT;
ALTER TABLE transaction_attachments ADD COLUMN new_id TEXT;
ALTER TABLE debts ADD COLUMN new_id TEXT;
ALTER TABLE debt_payments ADD COLUMN new_id TEXT;
ALTER TABLE retailku_sync_field_mapping ADD COLUMN new_id TEXT;

UPDATE account_groups SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE categories SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE contacts SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE accounts SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE transactions SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE transaction_attachments SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE debts SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE debt_payments SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);
UPDATE retailku_sync_field_mapping SET new_id = lower(
    printf('%08x', (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) >> 16) & 0xffffffff)
    || '-' || printf('%04x', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) & 0xffff)
    || '-7' || substr(hex(randomblob(2)), 1, 3)
    || '-' || substr('89ab', (abs(random()) % 4) + 1, 1) || substr(hex(randomblob(2)), 1, 3)
    || '-' || hex(randomblob(6))
);

-- ============================================================
-- 1. Rename SEMUA tabel lama & drop SEMUA index lama (pola 0009/0022
-- PENTING #2 -- lihat catatan di atas file ini).
-- ============================================================

DROP INDEX IF EXISTS idx_accounts_group;
DROP INDEX IF EXISTS idx_categories_parent;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_account;
DROP INDEX IF EXISTS idx_transactions_transfer_account;
DROP INDEX IF EXISTS idx_transactions_contact_id;
DROP INDEX IF EXISTS idx_transactions_source_ref;
DROP INDEX IF EXISTS idx_contacts_name;
DROP INDEX IF EXISTS idx_transaction_attachments_transaction;
DROP INDEX IF EXISTS idx_debts_contact_id;
DROP INDEX IF EXISTS idx_debts_status;
DROP INDEX IF EXISTS idx_debts_source_ref;
DROP INDEX IF EXISTS idx_debt_payments_debt;
DROP INDEX IF EXISTS idx_debt_payments_source_ref;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_local_account;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_category;
DROP INDEX IF EXISTS idx_retailku_sync_field_mapping_secondary_account;

ALTER TABLE account_groups RENAME TO account_groups_old;
ALTER TABLE categories RENAME TO categories_old;
ALTER TABLE contacts RENAME TO contacts_old;
ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;
ALTER TABLE retailku_sync_field_mapping RENAME TO retailku_sync_field_mapping_old;

-- ============================================================
-- 2. Buat semua tabel baru (skema identik + id TEXT, sesuai urutan
-- dependency) & salin data dgn FK di-remap via JOIN ke new_id.
-- ============================================================

-- 2.1 account_groups -- tidak referensi apa pun
CREATE TABLE account_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO account_groups (id, name, created_at)
    SELECT new_id, name, created_at FROM account_groups_old;

-- 2.2 categories -- self-referencing parent_id, SEKALIAN tambah created_at
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO categories (id, name, icon, type, parent_id, is_active, created_at)
    SELECT c.new_id, c.name, c.icon, c.type, parent.new_id, c.is_active, datetime('now')
    FROM categories_old c
    LEFT JOIN categories_old parent ON parent.id = c.parent_id;
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- 2.3 contacts -- tidak referensi apa pun
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO contacts (id, name, note, created_at)
    SELECT new_id, name, note, created_at FROM contacts_old;
CREATE INDEX idx_contacts_name ON contacts(name);

-- 2.4 accounts -- referensi account_groups
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt')),
    color TEXT
);
INSERT INTO accounts (id, name, icon, initial_balance, created_at, group_id, description, is_active, account_type, color)
    SELECT a.new_id, a.name, a.icon, a.initial_balance, a.created_at, grp.new_id, a.description, a.is_active, a.account_type, a.color
    FROM accounts_old a
    LEFT JOIN account_groups_old grp ON grp.id = a.group_id;
CREATE INDEX idx_accounts_group ON accounts(group_id);

-- 2.5 transactions -- referensi categories, accounts (x2), contacts
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
    source_ref TEXT
);
INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at, description, contact_id, source, source_ref)
    SELECT
        t.new_id, t.type, t.amount, cat.new_id, acc.new_id, xfer.new_id, t.note, t.date, t.created_at,
        t.description, con.new_id, t.source, t.source_ref
    FROM transactions_old t
    LEFT JOIN categories_old cat ON cat.id = t.category_id
    LEFT JOIN accounts_old acc ON acc.id = t.account_id
    LEFT JOIN accounts_old xfer ON xfer.id = t.transfer_account_id
    LEFT JOIN contacts_old con ON con.id = t.contact_id;
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;

-- 2.6 transaction_attachments -- referensi transactions
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO transaction_attachments (id, transaction_id, file_path, created_at)
    SELECT ta.new_id, t.new_id, ta.file_path, ta.created_at
    FROM transaction_attachments_old ta
    JOIN transactions_old t ON t.id = ta.transaction_id;
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

-- 2.7 debts -- referensi contacts, accounts, transactions
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
    source_ref TEXT
);
INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, status, note, date, created_at, source, source_ref)
    SELECT
        d.new_id, d.type, con.new_id, d.amount, acc.new_id, t.new_id, d.status, d.note, d.date, d.created_at,
        d.source, d.source_ref
    FROM debts_old d
    LEFT JOIN contacts_old con ON con.id = d.contact_id
    LEFT JOIN accounts_old acc ON acc.id = d.account_id
    LEFT JOIN transactions_old t ON t.id = d.transaction_id;
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);
CREATE UNIQUE INDEX idx_debts_source_ref
    ON debts(source, source_ref)
    WHERE source_ref IS NOT NULL;

-- 2.8 debt_payments -- referensi debts, accounts, transactions
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
    source_ref TEXT
);
INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, note, date, created_at, source, source_ref)
    SELECT
        dp.new_id, d.new_id, dp.amount, acc.new_id, t.new_id, dp.note, dp.date, dp.created_at,
        dp.source, dp.source_ref
    FROM debt_payments_old dp
    JOIN debts_old d ON d.id = dp.debt_id
    LEFT JOIN accounts_old acc ON acc.id = dp.account_id
    LEFT JOIN transactions_old t ON t.id = dp.transaction_id;
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE UNIQUE INDEX idx_debt_payments_source_ref
    ON debt_payments(source, source_ref)
    WHERE source_ref IS NOT NULL;

-- 2.9 retailku_sync_field_mapping -- referensi accounts (x2), categories
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
        m.new_id, m.key, m.retailku_account_id, m.retailku_account_code, m.retailku_account_name,
        local_acc.new_id, m.note, cat.new_id, m.description, m.created_at, m.updated_at,
        sec_acc.new_id, m.source_kind, m.extra_fields
    FROM retailku_sync_field_mapping_old m
    JOIN accounts_old local_acc ON local_acc.id = m.local_account_id
    LEFT JOIN categories_old cat ON cat.id = m.category_id
    LEFT JOIN accounts_old sec_acc ON sec_acc.id = m.secondary_account_id;
CREATE INDEX idx_retailku_sync_field_mapping_local_account
    ON retailku_sync_field_mapping(local_account_id);
CREATE INDEX idx_retailku_sync_field_mapping_category
    ON retailku_sync_field_mapping(category_id);
CREATE INDEX idx_retailku_sync_field_mapping_secondary_account
    ON retailku_sync_field_mapping(secondary_account_id);

-- ============================================================
-- 3. Drop SEMUA tabel lama di akhir (aman sekarang -- tidak ada lagi FK
-- ON DELETE SET NULL/CASCADE aktif yang menunjuk ke tabel `_old` ini,
-- semua tabel baru menunjuk ke tabel BARU lewat nama yang sama).
-- ============================================================

DROP TABLE retailku_sync_field_mapping_old;
DROP TABLE debt_payments_old;
DROP TABLE debts_old;
DROP TABLE transaction_attachments_old;
DROP TABLE transactions_old;
DROP TABLE accounts_old;
DROP TABLE contacts_old;
DROP TABLE categories_old;
DROP TABLE account_groups_old;

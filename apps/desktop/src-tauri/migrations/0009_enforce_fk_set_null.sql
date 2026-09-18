-- Menegakkan foreign key dengan ON DELETE SET NULL untuk semua relasi
-- opsional (category_id, account_id, transfer_account_id, group_id,
-- parent_id). SQLite tidak mengizinkan ALTER TABLE untuk menambah/mengubah
-- foreign key constraint pada tabel yang sudah ada, jadi dipakai pola
-- copy-and-rename: buat tabel _new dengan constraint yang benar, salin
-- data, hapus tabel lama, ganti nama tabel _new.
--
-- SET NULL dipilih (bukan CASCADE/RESTRICT) supaya riwayat transaksi tidak
-- pernah ikut terhapus otomatis hanya karena akun/kategori/grup rujukannya
-- dihapus — konsisten dengan pola "smart delete" (unassign/reassign) yang
-- sudah diterapkan di semua dialog hapus akun/kategori/grup akun.

PRAGMA foreign_keys = OFF;

-- categories: parent_id -> categories(id) ON DELETE SET NULL
CREATE TABLE categories_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);
INSERT INTO categories_new (id, name, icon, type, parent_id, is_active)
    SELECT id, name, icon, type, parent_id, is_active FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- account_groups: tidak ada foreign key keluar, tidak perlu diubah.

-- accounts: group_id -> account_groups(id) ON DELETE SET NULL
CREATE TABLE accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id INTEGER REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);
INSERT INTO accounts_new (id, name, icon, initial_balance, created_at, group_id, description, is_active)
    SELECT id, name, icon, initial_balance, created_at, group_id, description, is_active FROM accounts;
DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;
CREATE INDEX idx_accounts_group ON accounts(group_id);

-- transactions: category_id/account_id/transfer_account_id ON DELETE SET NULL
CREATE TABLE transactions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount REAL NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transfer_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO transactions_new (id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at)
    SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at FROM transactions;
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);

PRAGMA foreign_keys = ON;

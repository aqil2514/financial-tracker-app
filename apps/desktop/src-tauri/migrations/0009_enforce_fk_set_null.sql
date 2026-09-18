-- Menegakkan foreign key dengan ON DELETE SET NULL untuk semua relasi
-- opsional (category_id, account_id, transfer_account_id, group_id,
-- parent_id). SQLite tidak mengizinkan ALTER TABLE untuk menambah/mengubah
-- foreign key constraint pada tabel yang sudah ada, jadi dipakai pola
-- copy-and-rename: buat tabel baru dengan constraint yang benar, salin
-- data, hapus tabel lama, ganti nama tabel baru.
--
-- SET NULL dipilih (bukan CASCADE/RESTRICT) supaya riwayat transaksi tidak
-- pernah ikut terhapus otomatis hanya karena akun/kategori/grup rujukannya
-- dihapus — konsisten dengan pola "smart delete" (unassign/reassign) yang
-- sudah diterapkan di semua dialog hapus akun/kategori/grup akun.
--
-- PENTING #1: `PRAGMA foreign_keys = OFF/ON` TIDAK BERPENGARUH di sini —
-- SQLite mengabaikan PRAGMA ini kalau dijalankan di dalam transaksi aktif
-- ("no-op within a transaction"), dan sqlx migrator (dipakai
-- tauri-plugin-sql) SELALU membungkus tiap migrasi dalam satu transaksi
-- tanpa opsi untuk menonaktifkannya.
--
-- PENTING #2 (bug yang lebih halus, ditemukan setelah PENTING #1
-- diperbaiki): urutan "proses tabel satu-per-satu sampai selesai
-- (create+insert+drop+rename), baru lanjut ke tabel berikutnya" TETAP
-- salah walau diurutkan dari yang paling sedikit direferensikan. Sebabnya:
-- begitu `transactions` selesai di-rename dan sudah punya FK
-- `ON DELETE SET NULL` ke `accounts`, giliran `DROP TABLE accounts`
-- dijalankan — dan SQLite (dengan FK aktif) memperlakukan DROP TABLE
-- seolah-olah menghapus semua barisnya satu per satu, sehingga trigger
-- `ON DELETE SET NULL` pada `transactions.account_id` benar-benar
-- tereksekusi dan meng-NULL-kan SELURUH account_id yang ada. Diperbaiki
-- dengan pola berbeda: rename SEMUA tabel lama ke nama sementara (`_old`)
-- dan drop SEMUA index lama-nya di awal, baru buat semua tabel baru +
-- salin data, dan baru drop semua tabel `_old` di paling akhir — supaya
-- tidak pernah ada momen sebuah tabel di-drop selagi ada FK
-- ON DELETE SET NULL yang sudah aktif menunjuk ke tabel tersebut.

-- 0. Singkirkan dulu semua tabel & index lama dari jalur aktif (rename,
-- bukan drop) supaya FK ON DELETE SET NULL dari tabel baru tidak pernah
-- "melihat" tabel lama ini di-drop.
DROP INDEX IF EXISTS idx_accounts_group;
DROP INDEX IF EXISTS idx_categories_parent;
DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_account;
DROP INDEX IF EXISTS idx_transactions_transfer_account;

ALTER TABLE transactions RENAME TO transactions_old;
ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE categories RENAME TO categories_old;

-- 1. accounts
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id INTEGER REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
);
INSERT INTO accounts (id, name, icon, initial_balance, created_at, group_id, description, is_active)
    SELECT id, name, icon, initial_balance, created_at, group_id, description, is_active FROM accounts_old;
CREATE INDEX idx_accounts_group ON accounts(group_id);

-- 2. categories — self-referencing lewat parent_id
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);
INSERT INTO categories (id, name, icon, type, parent_id, is_active)
    SELECT id, name, icon, type, parent_id, is_active FROM categories_old;
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- 3. transactions
CREATE TABLE transactions (
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
INSERT INTO transactions (id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at)
    SELECT id, type, amount, category_id, account_id, transfer_account_id, note, date, created_at FROM transactions_old;
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);

-- 4. Baru sekarang aman men-drop semua tabel lama — tidak ada lagi FK
-- ON DELETE SET NULL yang menunjuk ke tabel-tabel `_old` ini (tabel baru
-- di atas semuanya menunjuk ke tabel BARU lewat nama yang sama).
DROP TABLE transactions_old;
DROP TABLE accounts_old;
DROP TABLE categories_old;

-- account_groups: tidak ada foreign key keluar, tidak perlu diubah.

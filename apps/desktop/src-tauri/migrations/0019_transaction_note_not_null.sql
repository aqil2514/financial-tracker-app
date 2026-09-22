-- `note` sudah wajib diisi lewat validasi form (transactionSchema:
-- `note: z.string().min(1, ...)`) sejak lama, tapi kolom database-nya
-- sendiri masih nullable — mis. baris lama (pra-validasi, atau insert
-- manual lewat SQL/debug) bisa punya `note` NULL. Ditegakkan di sini
-- supaya konsisten: UI (content/list/content/item/info.tsx) bisa
-- menampilkan `note` sebagai judul utama tanpa cek null lagi.
--
-- Baris existing yang `note`-nya NULL di-backfill jadi placeholder
-- eksplisit "Tanpa catatan" (bukan string kosong) SEBELUM constraint
-- NOT NULL diterapkan, supaya migrasi tidak gagal DAN data lama tetap
-- kelihatan sebagai "memang tidak diisi", bukan diam-diam kosong.
--
-- SQLite tidak mengizinkan ALTER TABLE untuk menambah/mengubah NOT NULL
-- pada kolom yang sudah ada — dipakai pola copy-and-rename yang sama
-- seperti 0009_enforce_fk_set_null.sql. `transactions` di sini TIDAK
-- direferensikan FK oleh tabel lain (dia yang mereferensikan
-- categories/accounts, bukan sebaliknya) — cuma `transaction_attachments`
-- yang FK ke sini dengan ON DELETE CASCADE, jadi rebuild tabel tunggal
-- ini aman tanpa risiko "PENTING #2" di 0009 (drop tabel lama TIDAK
-- memicu CASCADE pada baris transactions manapun, karena arah CASCADE-nya
-- attachments -> transactions, bukan sebaliknya).

UPDATE transactions SET note = 'Tanpa catatan' WHERE note IS NULL;

DROP INDEX IF EXISTS idx_transactions_date;
DROP INDEX IF EXISTS idx_transactions_category;
DROP INDEX IF EXISTS idx_transactions_account;
DROP INDEX IF EXISTS idx_transactions_transfer_account;
DROP INDEX IF EXISTS idx_transactions_contact_id;
DROP INDEX IF EXISTS idx_transactions_source_ref;

ALTER TABLE transactions RENAME TO transactions_old;

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount REAL NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transfer_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT
);

INSERT INTO transactions (
    id, type, amount, category_id, account_id, transfer_account_id, note,
    date, created_at, description, contact_id, source, source_ref
)
SELECT
    id, type, amount, category_id, account_id, transfer_account_id, note,
    date, created_at, description, contact_id, source, source_ref
FROM transactions_old;

CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;

DROP TABLE transactions_old;

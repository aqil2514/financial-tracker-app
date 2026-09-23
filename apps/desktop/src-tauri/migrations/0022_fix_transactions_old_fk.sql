-- Bug ditemukan (2026-09-24) saat menguji fitur sync AR/AP baru: INSERT
-- ke `debts` gagal dengan "no such table: main.transactions_old".
--
-- Akar penyebab: migrasi 0019 (`ALTER TABLE transactions RENAME TO
-- transactions_old`, lalu buat ulang `transactions`, lalu `DROP TABLE
-- transactions_old`) HANYA merebuild `transactions` sendiri — TIDAK
-- ikut merebuild `debts`/`debt_payments`/`transaction_attachments` yang
-- FK `transaction_id`-nya menunjuk ke situ. SQLite TIDAK mengikuti nama
-- tabel yang di-RENAME pada FK constraint tabel LAIN (FK menyimpan nama
-- string literal apa adanya di skema) — jadi ketiga tabel itu sekarang
-- py FK ke `"transactions_old"`, tabel yang SUDAH di-drop di akhir
-- migrasi 0019. Ini melanggar pola yang SUDAH didokumentasikan sendiri
-- di 0009_enforce_fk_set_null.sql ("PENTING #2": SEMUA tabel yang
-- terlibat harus di-rename dulu SEBELUM drop apa pun, migrasi 0019
-- tidak mengikuti ini untuk 3 tabel yang mereferensikan `transactions`).
--
-- Perbaikan: rebuild `transaction_attachments`/`debts`/`debt_payments`
-- dengan FK yang benar mengarah ke `transactions` (nama tabel yang
-- SEKARANG aktif) — SAMA PERSIS skema kolom/constraint yang sudah ada,
-- CUMA nama tabel target FK yang diperbaiki. Ikuti pola "rename semua
-- dulu, baru drop semua di akhir" dari 0009, karena `debt_payments`
-- SENDIRI py FK ke `debts` (kalau `debts` di-drop sebelum `debt_payments`
-- selesai dibuat ulang, ON DELETE CASCADE akan ikut menghapus baris
-- debt_payments yang masih valid).

DROP INDEX IF EXISTS idx_transaction_attachments_transaction;
DROP INDEX IF EXISTS idx_debts_contact_id;
DROP INDEX IF EXISTS idx_debts_status;
DROP INDEX IF EXISTS idx_debt_payments_debt;

ALTER TABLE transaction_attachments RENAME TO transaction_attachments_old;
ALTER TABLE debts RENAME TO debts_old;
ALTER TABLE debt_payments RENAME TO debt_payments_old;

CREATE TABLE transaction_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO transaction_attachments (id, transaction_id, file_path, created_at)
    SELECT id, transaction_id, file_path, created_at FROM transaction_attachments_old;
CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);

CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO debts (id, type, contact_id, amount, account_id, transaction_id, status, note, date, created_at)
    SELECT id, type, contact_id, amount, account_id, transaction_id, status, note, date, created_at FROM debts_old;
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);

CREATE TABLE debt_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO debt_payments (id, debt_id, amount, account_id, transaction_id, note, date, created_at)
    SELECT id, debt_id, amount, account_id, transaction_id, note, date, created_at FROM debt_payments_old;
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);

-- Aman drop sekarang — tidak ada lagi FK aktif yang menunjuk ke tabel
-- `_old` ini (tabel baru semuanya menunjuk ke tabel BARU lewat nama
-- yang sama, mengikuti pola 0009).
DROP TABLE transaction_attachments_old;
DROP TABLE debt_payments_old;
DROP TABLE debts_old;

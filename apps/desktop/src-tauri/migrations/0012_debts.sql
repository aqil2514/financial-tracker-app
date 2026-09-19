-- Fitur utang piutang: entitas sendiri (bukan sekadar transaksi biasa),
-- lihat docs/todos/plan/debt-receivable-tracking.md. Satu tabel `debts`
-- menangani KEDUA arah (piutang & utang), dibedakan lewat kolom `type` —
-- strukturnya identik, cuma beda arah uang.

-- Kontak sebagai entitas UMUM (bukan cuma untuk utang piutang) — nama
-- pihak yang sama sering berulang di transaksi biasa juga (mis. "Dikasih
-- Mama", "Wayu Nukerin"), jadi dibuat sebagai tabel mandiri, bukan kolom
-- TEXT bebas per-debts (yang akan pecah karena variasi penulisan seperti
-- "Mama Minjem" vs "mama balikin" di data historis).
CREATE TABLE contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_contacts_name ON contacts(name);

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

CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);

-- Cicilan/pelunasan sebagian, terhubung ke satu `debts` (pokok). Sisa
-- utang/piutang = debts.amount - SUM(debt_payments.amount).
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

CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);

-- Fitur utang piutang: entitas sendiri (bukan sekadar transaksi biasa),
-- lihat docs/todos/plan/debt-receivable-tracking.md. Satu tabel menangani
-- KEDUA arah (piutang & utang), dibedakan lewat kolom `type` — strukturnya
-- identik, cuma beda arah uang.
CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_name TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_debts_contact_name ON debts(contact_name);
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

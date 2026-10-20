-- docs/todos/(plan|done)/balance-correction-derived-data-consistency.md -- jejak
-- eksplisit tiap kali correctDebtRemaining menaikkan debts.amount LANGSUNG
-- (arah "naik", tanpa insert debt_payments sama sekali) -- supaya fitur
-- "Cek Konsistensi" bisa membedakan transaksi koreksi yang SAH dari
-- transaksi yatim sungguhan, tanpa heuristik yang rapuh. Tabel baru murni,
-- tidak mengubah skema tabel manapun yang sudah ada -- tidak perlu teknik
-- copy-and-rename.

CREATE TABLE debt_amount_adjustments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    delta REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_debt_amount_adjustments_debt ON debt_amount_adjustments(debt_id);
CREATE INDEX idx_debt_amount_adjustments_transaction ON debt_amount_adjustments(transaction_id);

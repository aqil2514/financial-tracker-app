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

CREATE INDEX idx_debt_amount_adjustments_debt ON debt_amount_adjustments(debt_id);
CREATE INDEX idx_debt_amount_adjustments_transaction ON debt_amount_adjustments(transaction_id);

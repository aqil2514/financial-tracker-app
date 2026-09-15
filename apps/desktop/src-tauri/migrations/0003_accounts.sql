CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO accounts (name, icon, initial_balance) VALUES
    ('Tunai', 'wallet', 0),
    ('Bank', 'landmark', 0),
    ('E-Wallet', 'smartphone', 0);

ALTER TABLE transactions ADD COLUMN account_id INTEGER REFERENCES accounts(id);
ALTER TABLE transactions ADD COLUMN transfer_account_id INTEGER REFERENCES accounts(id);

UPDATE transactions SET account_id = (SELECT id FROM accounts ORDER BY id LIMIT 1)
WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);

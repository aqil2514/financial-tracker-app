CREATE TABLE IF NOT EXISTS account_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO account_groups (name) VALUES
    ('Aset Lancar'),
    ('Bank'),
    ('E-Wallet'),
    ('Investasi'),
    ('Utang');

ALTER TABLE accounts ADD COLUMN group_id INTEGER REFERENCES account_groups(id);
ALTER TABLE accounts ADD COLUMN description TEXT;

CREATE INDEX IF NOT EXISTS idx_accounts_group ON accounts(group_id);

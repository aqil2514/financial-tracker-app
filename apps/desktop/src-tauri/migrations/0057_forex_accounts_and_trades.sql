-- Tabel detail tipe akun Valas -- langkah 1 lanjutan dari
-- apps/desktop/docs/todos/plan/account-type-forex.md, model data lengkap di
-- docs/concept/konsep-valas.md. Tabel baru murni, tidak mengubah skema
-- tabel manapun yang sudah ada (CHECK account_type sudah dibuka di 0056) --
-- tidak perlu copy-and-rename.
--
-- Meniru investasi (0036-0042) TANPA kolom `status`: beli valas langsung
-- final, jadi unit/rate selalu diketahui dan average_cost_per_unit +
-- realized_pl di forex_sales langsung dihitung saat jual (NOT NULL).
-- Kolom sync (updated_at/deleted_at/sync_source) dimasukkan sejak awal
-- supaya tidak perlu migrasi tambahan saat tahap Worker.

-- `forex_accounts` -- 1:1 dengan accounts (account_type = 'forex').
-- `current_rate` = rupiah per 1 unit mata uang asing, manual, TIDAK PERNAH
-- mengubah accounts.balance (modal rupiah tetap dari transaksi).
CREATE TABLE forex_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    currency TEXT NOT NULL,
    current_rate REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE TRIGGER trg_forex_accounts_updated_at
AFTER UPDATE ON forex_accounts
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE forex_accounts SET updated_at = datetime('now') WHERE account_id = NEW.account_id;
END;

-- `forex_purchases` -- riwayat beli, lahir dari transfer kas -> akun valas
-- (atau mode direct). Total unit TIDAK disimpan sebagai kolom, selalu SUM.
CREATE TABLE forex_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    rate REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_forex_purchases_account ON forex_purchases(account_id);
CREATE INDEX idx_forex_purchases_transaction ON forex_purchases(transaction_id);

CREATE TRIGGER trg_forex_purchases_updated_at
AFTER UPDATE ON forex_purchases
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE forex_purchases SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- `forex_sales` -- riwayat jual valas ke rupiah. Dua transaksi per jual,
-- pola sama investment_sales: transaction_id = leg transfer senilai
-- average_cost x unit, adjustment_transaction_id = leg selisih kurs
-- (NULL kalau realized_pl == 0).
CREATE TABLE forex_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    rate REAL NOT NULL,
    average_cost_per_unit REAL NOT NULL,
    realized_pl REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_forex_sales_account ON forex_sales(account_id);
CREATE INDEX idx_forex_sales_transaction ON forex_sales(transaction_id);
CREATE INDEX idx_forex_sales_adjustment_transaction ON forex_sales(adjustment_transaction_id);

CREATE TRIGGER trg_forex_sales_updated_at
AFTER UPDATE ON forex_sales
FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN
    UPDATE forex_sales SET updated_at = datetime('now') WHERE id = NEW.id;
END;

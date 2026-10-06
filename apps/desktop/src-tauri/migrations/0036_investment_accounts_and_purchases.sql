-- Tabel detail tipe akun Investasi -- langkah 1 lanjutan dari
-- apps/desktop/docs/todos/plan/account-type-investment.md, model data
-- lengkap di docs/concept/konsep-investasi.md. Tabel baru murni, tidak
-- mengubah skema tabel manapun yang sudah ada -- tidak perlu teknik
-- copy-and-rename.

-- `investment_accounts` -- 1:1 dengan accounts (account_type =
-- 'investment'), pola sama rencana credit_accounts di account-type.md.
-- `current_price_per_unit` manual, diupdate user kapan saja (lihat
-- konsep-investasi.md bagian "Harga per unit terkini") -- TIDAK PERNAH
-- mengubah accounts.balance.
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_price_per_unit REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- `investment_purchases` -- riwayat pembelian per lot, lahir otomatis
-- dari transaksi transfer kas -> akun investment (pola sama `debts`
-- lahir dari transfer kas<->debt, lihat applyDebtTransaction). `status`
-- menangani settlement tertunda (reksadana T+1/T+2) -- SOLUSI SEMENTARA
-- sampai tipe akun `advance` ada (lihat konsep-investasi.md, "Catatan
-- desain" di bagian Settlement tertunda), BUKAN keputusan final.
-- total_unit TIDAK disimpan sebagai kolom -- selalu SUM dari sini.
CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

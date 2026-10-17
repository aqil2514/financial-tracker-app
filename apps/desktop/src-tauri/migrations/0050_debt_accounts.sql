-- Tabel detail tipe akun Utang Piutang -- lanjutan dari
-- apps/desktop/docs/todos/plan/debt-account-direction.md. Tabel baru
-- murni, tidak mengubah skema tabel manapun yang sudah ada -- tidak
-- perlu teknik copy-and-rename.

-- `debt_accounts` -- 1:1 dengan accounts (account_type = 'debt'), pola
-- sama investment_accounts. `direction` membedakan akun debt yang
-- khusus piutang/utang dari akun netral 2-arah ('both') -- dipakai
-- untuk filter dropdown new-debt-form.tsx & validasi
-- applyDebtTransaction, BUKAN diisi heuristik runtime.
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable', 'both'))
);

-- Backfill akun debt existing berdasarkan histori pemakaian riil di
-- `debts` (dicek manual saat dogfooding 2026-10-16, lihat tabel di
-- debt-account-direction.md) -- bukan tebakan dari nama akun.
INSERT INTO debt_accounts (account_id, direction)
SELECT id, CASE name
    WHEN 'Piutang' THEN 'receivable'
    WHEN 'Piutang Dagang' THEN 'receivable'
    WHEN 'Utang Dagang' THEN 'payable'
    ELSE 'both'
END
FROM accounts
WHERE account_type = 'debt';

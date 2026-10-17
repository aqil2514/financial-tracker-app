-- Port "direction" akun utang/piutang dari desktop (migrasi Tauri
-- 0050/0051) ke Worker -- docs/todos/plan/debt-account-direction.md.
-- Setiap akun debt WAJIB punya direction ('receivable' ATAU 'payable',
-- tidak ada netral) -- satu-satunya sumber kebenaran untuk `debts.type`
-- saat createDirectDebt dipanggil, menggantikan `payload.type` yang
-- sebelumnya dipercaya mentah dari client (lihat service.ts).
--
-- Tabel baru murni, tidak ada data existing -- pola identik
-- investment_accounts di 0002_account_type_investment.sql (account_id
-- PK + FK CASCADE, DITAMBAH updated_at/deleted_at/sync_source LWW yang
-- tidak dipunyai desktop). Tidak mengubah CHECK constraint apa pun di
-- `accounts`/`debts` yang sudah ada -- cukup CREATE TABLE, tidak perlu
-- copy-and-rename.

CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

-- Ketatkan debt_accounts.direction: hapus opsi 'both' -- revisi
-- docs/concept/konsep-utang-piutang.md 2026-10-17, "Setiap akun
-- Utang/Piutang punya arah (direction) yang tetap". Setiap akun debt
-- WAJIB 'receivable' atau 'payable', tidak ada lagi netral/dua-arah --
-- kalau kebutuhannya mencatat dua arah ke pihak yang sama, itu dua
-- akun terpisah (mis. "Piutang Keluarga"/"Utang Keluarga"), bukan satu
-- akun ambigu.
--
-- Tidak ada tabel lain yang FK ke debt_accounts (dicek:
-- `grep -r "REFERENCES debt_accounts("`), jadi pola copy-and-rename
-- SEDERHANA cukup (docs/rules/sqlite-copy-and-rename-migration.md).
--
-- Production (dicek langsung, bukan diasumsikan) cuma punya 3 akun
-- debt -- "Piutang"/"Piutang Dagang" (receivable), "Utang Dagang"
-- (payable) -- semuanya SUDAH benar arahnya dari backfill 0050, tidak
-- ada satu pun akun 'both' yang perlu direklasifikasi. Data dev yang
-- sempat punya akun netral tambahan (Keluarga/Orang Lain/Bisnis)
-- murni data uji coba, ditangani terpisah di luar migrasi ini.

CREATE TABLE debt_accounts_new (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable'))
);
INSERT INTO debt_accounts_new (account_id, direction)
    SELECT account_id, direction FROM debt_accounts WHERE direction != 'both';
DROP TABLE debt_accounts;
ALTER TABLE debt_accounts_new RENAME TO debt_accounts;

-- Ganti model nilai pasar terkini di `investment_accounts`: dari
-- `current_price_per_unit` (harga PER UNIT, dikali total_unit utk dapat
-- nilai pasar) jadi `current_market_value` (nilai pasar TOTAL, diisi
-- manual langsung oleh user) -- keputusan 2026-10-06, lihat diskusi di
-- docs/todos/plan/account-type-investment.md.
--
-- KENAPA: user cukup lihat "nilai portofolio saya sekarang Rp X" dari
-- aplikasi investasi lain (reksadana/saham), tanpa perlu tahu/hitung
-- harga per unit terpisah. `price_per_unit` TETAP ada -- tapi turun ke
-- level `investment_purchases` (riwayat pembelian per lot), yang
-- sekarang murni jadi SNAPSHOT historis harga beli, bukan sumber hitung
-- nilai pasar terkini lagi.
--
-- investment_accounts TIDAK direferensikan FK oleh tabel lain dan belum
-- punya data user sungguhan (fitur baru, belum rilis) -- pola sederhana
-- (satu tabel, rebuild) cukup, lihat
-- docs/rules/sqlite-copy-and-rename-migration.md "Kapan boleh pakai pola
-- sederhana".

CREATE TABLE investment_accounts_new (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO investment_accounts_new (account_id, unit_label, current_market_value, updated_at)
    SELECT account_id, unit_label, 0, updated_at FROM investment_accounts;

DROP TABLE investment_accounts;
ALTER TABLE investment_accounts_new RENAME TO investment_accounts;

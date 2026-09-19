-- Tipe akun — lihat docs/todos/plan/account-type.md. Scope AWAL cuma
-- 'cash' (default, akun kas/bank biasa) dan 'debt' (akun virtual utang
-- piutang, lihat docs/todos/plan/debt-receivable-tracking.md — pola
-- "Keluarga"/"Orang Lain"/"Di orang lain" yang sudah lama dipakai
-- manual). Tipe kompleks lain (credit/investment/forex) MENYUSUL sebagai
-- migrasi terpisah begitu didesain lebih lanjut — menambah value baru ke
-- CHECK ini nanti perlu teknik copy-and-rename (SQLite tidak izinkan
-- ALTER CHECK constraint yang sudah ada), sama seperti pola migrasi 0009.
ALTER TABLE accounts ADD COLUMN account_type TEXT NOT NULL DEFAULT 'cash'
    CHECK (account_type IN ('cash', 'debt'));

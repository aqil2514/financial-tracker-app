-- `investment_purchases.unit`/`price_per_unit` jadi NULLABLE -- keputusan
-- 2026-10-06, lihat docs/todos/plan/account-type-investment.md.
--
-- KENAPA: di aplikasi reksadana nyata (mis. Bibit), order BELI yang masih
-- diproses (pending) belum tahu persis unit yang didapat -- NAB/harga
-- final baru ditentukan setelah settlement (T+1/T+2). Sebelumnya field
-- ini WAJIB diisi (estimasi) saat transaksi dibuat; sekarang boleh
-- dikosongkan dulu, lalu diisi belakangan lewat UI edit baris (lihat
-- "Riwayat Pembelian" di halaman /investments/detail) begitu settlement
-- benar-benar dikonfirmasi dan nilainya sudah pasti.
--
-- investment_purchases TIDAK direferensikan FK oleh tabel lain (cuma
-- `transaction_id` di tabel ini sendiri yang mereferensikan `transactions`,
-- arah sebaliknya) dan belum punya data user sungguhan (fitur baru, belum
-- rilis) -- pola sederhana (satu tabel, rebuild) cukup, lihat
-- docs/rules/sqlite-copy-and-rename-migration.md "Kapan boleh pakai pola
-- sederhana".

CREATE TABLE investment_purchases_new (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO investment_purchases_new (id, account_id, transaction_id, unit, price_per_unit, date, status, created_at)
    SELECT id, account_id, transaction_id, unit, price_per_unit, date, status, created_at FROM investment_purchases;

DROP TABLE investment_purchases;
ALTER TABLE investment_purchases_new RENAME TO investment_purchases;

CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

-- `investment_sales.average_cost_per_unit`/`realized_pl` jadi NULLABLE --
-- keputusan 2026-10-07, lihat docs/todos/plan/account-type-investment.md.
--
-- KENAPA: desain awal men-snapshot average_cost_per_unit & realized_pl
-- SAAT baris dibuat (status 'pending'), termasuk saat dana penjualan
-- belum benar-benar cair ke kas. Ternyata dana YANG MASUK KE KAS juga
-- harus ditunda sampai status 'settled' (dulu langsung dibuat transaksi
-- transfer saat create, padahal secara riil dana belum cair selama order
-- masih diproses) -- dan Realized P/L baru final/boleh ditulis permanen
-- begitu transaksi penjualan benar-benar settled, BUKAN saat masih
-- pending (average cost bisa masih bergeser kalau ada pembelian baru di
-- antara create dan settle). Kedua kolom ini sekarang NULL selama status
-- 'pending' (belum dihitung sama sekali), baru diisi saat settle.
--
-- investment_sales TIDAK direferensikan FK oleh tabel lain dan belum ada
-- data user sungguhan (fitur belum dipasang ke UI/belum dirilis) -- pola
-- sederhana (satu tabel, rebuild) cukup, sama seperti migrasi 0038.

CREATE TABLE investment_sales_new (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    average_cost_per_unit REAL,
    realized_pl REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO investment_sales_new (id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, created_at)
    SELECT id, account_id, transaction_id, adjustment_transaction_id, unit, price_per_unit, average_cost_per_unit, realized_pl, date, status, created_at FROM investment_sales;

DROP TABLE investment_sales;
ALTER TABLE investment_sales_new RENAME TO investment_sales;

CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);

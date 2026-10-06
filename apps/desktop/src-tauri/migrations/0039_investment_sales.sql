-- Tabel riwayat penjualan/penarikan sebagian investasi -- langkah lanjutan
-- dari apps/desktop/docs/todos/plan/account-type-investment.md bagian
-- "Penjualan", model data lengkap di docs/concept/konsep-investasi.md
-- bagian "Penjualan/penarikan sebagian". Tabel baru murni, tidak mengubah
-- skema tabel manapun yang sudah ada -- tidak perlu teknik copy-and-rename.

-- `investment_sales` -- riwayat penjualan per lot, lahir dari transaksi
-- transfer investment -> kas (pola sama `investment_purchases`, arah
-- sebaliknya). Beda dari pembelian: average_cost_per_unit dan realized_pl
-- DISIMPAN sebagai snapshot saat transaksi terjadi (bukan dihitung ulang
-- nanti) karena average cost terus berubah seiring pembelian baru --
-- tanpa snapshot, Realized P/L historis tidak bisa direkonstruksi akurat.
-- `status` menangani settlement tertunda sama seperti pembelian (realitanya
-- penjualan juga tidak selalu instan, mis. reksadana T+1/T+2) -- unit
-- dikurangi OPTIMIS begitu baris dibuat (status 'pending'), simetris
-- dengan pembelian, BUKAN menunggu 'settled'.
CREATE TABLE investment_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    average_cost_per_unit REAL NOT NULL,
    realized_pl REAL NOT NULL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);

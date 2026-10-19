-- docs/todos/plan/cash-neutral-transaction-flag.md -- tandai transaksi
-- penutup otomatis (write-off debt/investasi, pelunasan non-cash,
-- koreksi saldo non-cash) yang TIDAK merepresentasikan kas riil
-- berpindah, supaya laporan cashflow bisa exclude baris ini.
-- Default 0 untuk semua baris lama & transaksi normal lewat form --
-- hanya titik insert "transaksi penutup" tertentu yang di-set 1.

ALTER TABLE transactions ADD COLUMN is_cash_neutral INTEGER NOT NULL DEFAULT 0;

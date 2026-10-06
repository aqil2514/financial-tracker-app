-- Tambah kolom `adjustment_transaction_id` ke `investment_sales` -- link
-- EKSPLISIT ke transaksi income/expense kedua yang direkam di akun kas
-- untuk selisih Realized P/L (lihat apply-sell-investment-transaction.ts:
-- nominal leg transfer utama = average_cost x unit, BUKAN nominal jual
-- penuh, supaya balance akun investment murni berkurang sebesar cost
-- basis yang dilepas -- selisihnya direkam sebagai transaksi kedua di
-- kas supaya kas tetap menerima nominal jual penuh). FK eksplisit
-- dipakai (bukan cari balik lewat kombinasi account_id+date+note) supaya
-- lookup saat edit/delete tidak pernah salah ambil baris kalau ada >1
-- penjualan di akun+tanggal yang sama. NULL kalau realized_pl == 0
-- (tidak ada selisih, tidak perlu transaksi kedua).
--
-- Migrasi TERPISAH dari 0039 (bukan diedit langsung di sana) karena 0039
-- sudah diterapkan ke finance.dev.db sebelum kebutuhan kolom ini
-- disadari -- `ALTER TABLE ADD COLUMN` cukup di sini (bukan copy-and-
-- rename) karena `investment_sales` TIDAK direferensikan FK oleh tabel
-- lain mana pun (lihat docs/rules/sqlite-copy-and-rename-migration.md,
-- "Kapan boleh pakai pola sederhana").
ALTER TABLE investment_sales ADD COLUMN adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);

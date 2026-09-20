-- Warna akun — lihat docs/todos/plan/account-icon-picker.md. Nilai
-- adalah nama warna dari palet TERBATAS (lihat lib/account-colors.ts),
-- BUKAN hex bebas — supaya hasilnya tetap konsisten dengan desain sistem
-- aplikasi. Kolom `accounts.icon` (nama komponen lucide-react) sudah ada
-- sejak awal skema, dipisah dari `color` supaya bentuk icon dan warna
-- bisa dipilih independen satu sama lain.
ALTER TABLE accounts ADD COLUMN color TEXT;

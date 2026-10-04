# Pola migrasi SQLite "copy-and-rename"

SQLite tidak mengizinkan `ALTER TABLE` untuk menambah/mengubah
`CHECK` constraint atau foreign key pada tabel yang sudah ada. Satu-
satunya cara mengubahnya adalah: buat tabel baru dengan skema yang
benar, salin data, hapus tabel lama, pasang nama tabel lama ke tabel
baru. Baca ini SEBELUM menulis migrasi yang mengubah `CHECK` atau FK
di tabel manapun.

Contoh nyata di repo ini: `0004_allow_transfer_type.sql`,
`0009_enforce_fk_set_null.sql`, `0019_transaction_note_not_null.sql`,
`0022_fix_transactions_old_fk.sql`, `0027_uuid_primary_keys.sql`.

## Kapan boleh pakai pola sederhana (satu tabel, `_new`)

Kalau tabel yang diubah TIDAK direferensikan oleh FK tabel lain (tidak
ada tabel lain yang punya `REFERENCES <tabel_ini>(...)`), pola
sederhana cukup:

```sql
CREATE TABLE transactions_new ( ... skema baru ... );
INSERT INTO transactions_new (...) SELECT ... FROM transactions;
DROP TABLE transactions;
ALTER TABLE transactions_new RENAME TO transactions;
CREATE INDEX IF NOT EXISTS ... -- index harus dibuat ulang, tidak ikut copy
```

## Kapan WAJIB pakai pola "rename semua dulu, baru drop semua di akhir"

Kalau tabel yang diubah **direferensikan FK oleh tabel lain** (termasuk
tabel yang TIDAK ikut berubah skemanya), pola sederhana di atas
BERBAHAYA dan bisa merusak data secara diam-diam. Wajib pakai pola ini:

```sql
-- 0. Drop semua index lama dulu (index ikut hilang saat tabel di-rename
-- tapi nama index tidak otomatis lepas, DROP INDEX di awal menghindari
-- konflik nama saat CREATE INDEX ulang di tabel baru nanti).
DROP INDEX IF EXISTS idx_accounts_group;
DROP INDEX IF EXISTS idx_transactions_account;

-- 1. RENAME SEMUA tabel yang terlibat (yang skemanya berubah MAUPUN
-- yang FK-nya menunjuk ke tabel yang berubah) — belum ada DROP sama
-- sekali di langkah ini.
ALTER TABLE accounts RENAME TO accounts_old;
ALTER TABLE transactions RENAME TO transactions_old;

-- 2. CREATE semua tabel baru (nama asli) + INSERT data dari tabel
-- _old + CREATE INDEX ulang. Urutan CREATE harus taat dependency FK
-- (tabel yang DIRUJUK duluan, baru tabel yang MERUJUK).
CREATE TABLE accounts ( ... );
INSERT INTO accounts (...) SELECT ... FROM accounts_old;
CREATE INDEX idx_accounts_group ON accounts(group_id);

CREATE TABLE transactions ( ... );
INSERT INTO transactions (...) SELECT ... FROM transactions_old;
CREATE INDEX idx_transactions_account ON transactions(account_id);

-- 3. BARU SEKARANG drop semua tabel _old, di akhir, setelah SEMUA
-- tabel baru selesai dibuat.
DROP TABLE transactions_old;
DROP TABLE accounts_old;
```

### Kenapa urutan ini wajib (dua bug nyata yang pernah terjadi di repo ini)

1. **`PRAGMA foreign_keys = OFF/ON` tidak berguna di dalam migrasi.**
   sqlx migrator (dipakai `tauri-plugin-sql`) selalu membungkus migrasi
   dalam satu transaksi, dan SQLite mengabaikan PRAGMA ini kalau
   dijalankan di dalam transaksi aktif ("no-op within a transaction").
   FK enforcement TETAP aktif sepanjang migrasi — jangan andalkan
   PRAGMA untuk "mematikan" FK sementara saat migrasi jalan.

2. **Drop-satu-per-satu (create+insert+drop+rename lalu lanjut tabel
   berikutnya) itu salah, walau tabel yang paling sedikit direferensikan
   didrop lebih dulu.** Begitu tabel A selesai dibuat ulang dengan FK
   `ON DELETE SET NULL`/`CASCADE` ke tabel B yang MASIH tabel lama, dan
   lalu tabel B itu di-`DROP`, SQLite memperlakukan drop itu seperti
   menghapus semua barisnya satu per satu — trigger FK itu benar-benar
   tereksekusi. Ditemukan di `0009`: begitu `transactions` (baru)
   selesai dengan FK `ON DELETE SET NULL` ke `accounts`, `DROP TABLE
   accounts` (lama) berikutnya memicu SET NULL men-NULL-kan SELURUH
   `account_id` di `transactions`. Solusinya: jangan drop apa pun sampai
   SEMUA tabel baru selesai dibuat (langkah 3 di atas).

3. **SQLite TIDAK mengikuti RENAME pada FK constraint tabel lain — FK
   menyimpan nama tabel target sebagai string literal apa adanya.**
   Kalau migrasi hanya me-rebuild tabel X (`X RENAME TO X_old` → buat
   `X` baru → `DROP X_old`) tapi ADA tabel Y lain yang punya
   `REFERENCES X(...)` dan Y TIDAK ikut di-rebuild, maka FK di Y akan
   tetap menunjuk ke string `"X_old"` — tabel yang sudah di-drop di
   akhir migrasi X. Baris baru di Y setelah itu akan gagal insert
   ("no such table: main.X_old"). Ditemukan di `0022`, akibat dari
   `0019` yang hanya me-rebuild `transactions` tanpa ikut me-rebuild
   `debts`/`debt_payments`/`transaction_attachments` yang FK-nya
   menunjuk ke `transactions`.

   **Konsekuensi konkret**: sebelum menulis migrasi copy-and-rename
   untuk tabel X, WAJIB `grep -r "REFERENCES X("` ke seluruh file
   migrasi untuk menemukan SEMUA tabel yang FK-nya menunjuk ke X —
   semua tabel itu harus ikut di-rebuild dalam migrasi yang sama,
   walau skema kolomnya sendiri tidak berubah sama sekali (cukup
   di-copy apa adanya, lihat `transaction_attachments`/`debts`/
   `debt_payments` di `0022` — kolomnya identik, cuma FK target yang
   diperbaiki).

## Cara verifikasi migrasi ini benar SEBELUM dianggap selesai

Menjalankan file `.sql` lewat `sqlite3` CLI TIDAK merepresentasikan
cara sqlx/`tauri-plugin-sql` benar-benar menjalankan migrasi (CLI
default autocommit per statement, sqlx membungkus dalam SATU
transaksi) — bisa memberi hasil false-positive. Replikasi konteks
eksekusi yang sesungguhnya:

```sql
PRAGMA foreign_keys = ON;
BEGIN;
-- isi migrasi di sini
COMMIT;
PRAGMA foreign_key_check;  -- harus kosong (tidak ada violation)
```

Lalu verifikasi row count tabel lama vs baru sama, DAN uji visual
langsung di aplikasi (`tauri dev`) untuk fitur yang datanya
tersentuh — bukan cuma percaya hasil row count/`foreign_key_check`
yang bisa saja tetap "bersih" padahal data sudah ter-NULL-kan secara
tidak sengaja (lihat bug #2 di atas, yang row count-nya tetap benar
karena SET NULL tidak mengubah jumlah baris).

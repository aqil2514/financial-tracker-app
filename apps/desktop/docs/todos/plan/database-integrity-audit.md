# Audit Integritas Skema Database

## Latar belakang

Menyusul audit kode lintas fitur (`scalability-audit.md`) dan perbaikan
`ConfirmDeleteButton`, dilakukan tinjauan ke sisi skema SQLite
(`src-tauri/migrations/*.sql`) untuk mencari risiko integritas data yang
setara dengan "delete tanpa konfirmasi" — bug korektnes yang bisa
menyebabkan kehilangan/korupsi data, bukan sekadar soal reuse kode.

## Temuan

### 1. Foreign key TIDAK ditegakkan sama sekali — SELESAI

**Status: dieksekusi.** Lihat `src-tauri/migrations/0009_enforce_fk_set_null.sql`
dan `src/lib/db.ts`.

Semua FK di skema (`transactions.category_id`, `transactions.account_id`,
`transactions.transfer_account_id`, `accounts.group_id`,
`categories.parent_id`) dideklarasikan dengan `REFERENCES ...`, tapi tidak
ditemukan `PRAGMA foreign_keys = ON` di mana pun
(`src-tauri/src/**/*.rs` — dicek via grep, nihil). SQLite **defaultnya
`foreign_keys = OFF`** per koneksi kecuali diaktifkan eksplisit.

Konsekuensi nyata: `ConfirmDeleteButton` yang baru dipasang di
`account-list.tsx` menampilkan pesan "Seluruh transaksi yang terkait
dengan akun ini tidak akan ikut terhapus, tapi referensinya akan hilang"
— ini kebetulan BENAR karena FK tidak ditegakkan, transaksi lama yang
mereferensikan `account_id` yang sudah dihapus akan diam-diam jadi orphan
reference (`account_id` menunjuk ke baris yang tidak ada), bukan gagal
atau ter-`SET NULL` otomatis. Sama halnya untuk hapus kategori (dipakai
`category_id` di transaksi) dan hapus account group (dipakai `group_id` di
accounts) — semuanya berpotensi menyisakan referensi rusak yang sifatnya
"diam-diam", tidak pernah divalidasi.

Ini menjelaskan (secara tidak sengaja) kenapa app tidak pernah "error"
saat hapus data yang masih direferensikan — bukan karena ditangani dengan
baik, tapi karena SQLite tidak mengecek sama sekali.

**Perbaikan yang dieksekusi**:
- Migration `0009_enforce_fk_set_null.sql` menerapkan pola copy-and-rename
  (tabel `_new` → copy data → drop → rename, sama seperti
  `0004_allow_transfer_type.sql`) untuk mendefinisikan ulang keempat FK
  opsional dengan `ON DELETE SET NULL`: `transactions.category_id`,
  `transactions.account_id`, `transactions.transfer_account_id`,
  `accounts.group_id`, `categories.parent_id`. `SET NULL` dipilih (bukan
  `CASCADE`/`RESTRICT`) supaya riwayat transaksi tidak pernah ikut
  terhapus otomatis hanya karena akun/kategori/grup rujukannya dihapus —
  konsisten dengan pola "smart delete" (unassign/reassign) yang sudah
  diterapkan di semua dialog hapus akun/kategori/grup akun.
- `src/lib/db.ts` menjalankan `PRAGMA foreign_keys = ON` setiap kali
  `getDb()` membuka koneksi baru — wajib dilakukan di sini, bukan cukup
  lewat migrasi, karena PRAGMA di dalam migrasi hanya berlaku untuk
  koneksi yang menjalankan migrasi itu, bukan koneksi-koneksi berikutnya.
- Dicek lebih dulu: tidak ada orphan reference existing di database
  production maupun hasil import Money Manager (`category_id`,
  `account_id`, `transfer_account_id`, `accounts.group_id`,
  `categories.parent_id` — semua nihil), jadi migrasi aman diterapkan
  langsung tanpa perlu pembersihan data dulu.
- **Koreksi penting (ditemukan belakangan lewat testing production
  nyata — lihat "Bug ditemukan saat testing visual" di
  `import-missing-detail-and-photos.md` untuk detail lengkap)**:
  verifikasi awal migrasi ini (row count sama, `SET NULL` "terbukti
  bekerja") dilakukan lewat `sqlite3` CLI yang menjalankan tiap statement
  secara **autocommit** (independen) — BUKAN dalam satu transaksi besar
  seperti cara sqlx (dipakai `tauri-plugin-sql`) benar-benar menjalankan
  migrasi. Hasilnya false-positive: migrasi ini sempat gagal TOTAL secara
  silent di production/dev sungguhan dengan dua bug berbeda yang baru
  ketahuan setelah fitur lampiran foto (migrasi 0010, yang bergantung
  pada 0009 sukses lebih dulu) diuji manual di aplikasi:
  1. `PRAGMA foreign_keys = OFF/ON` di migrasi tidak berpengaruh sama
     sekali di dalam transaksi aktif (no-op resmi SQLite), sehingga FK
     enforcement tetap aktif sepanjang migrasi dan `DROP TABLE` gagal
     dengan "FOREIGN KEY constraint failed".
  2. Setelah PRAGMA dihapus dan urutan DROP diperbaiki (tabel yang
     tidak direferensikan didrop lebih dulu), migrasi "berhasil" tapi
     ternyata **merusak data**: begitu `transactions` selesai
     di-rename dengan FK `ON DELETE SET NULL` aktif ke `accounts`,
     `DROP TABLE accounts` berikutnya memicu SQLite memperlakukan drop
     itu seperti menghapus semua baris `accounts` satu per satu —
     trigger SET NULL benar-benar jalan dan meng-NULL-kan SELURUH
     `account_id` di `transactions`.

  Migrasi final (isi `0009_enforce_fk_set_null.sql` saat ini) memakai
  pola berbeda: rename SEMUA tabel lama ke nama sementara (`_old`) dan
  drop SEMUA index lama-nya di awal, baru buat semua tabel baru + salin
  data, baru drop semua tabel `_old` di paling akhir — supaya tidak
  pernah ada momen sebuah tabel di-drop selagi ada FK `ON DELETE SET NULL`
  aktif yang menunjuk ke situ. Diverifikasi ulang dengan BENAR (replikasi
  transaksi sqlx yang sesungguhnya: `BEGIN`/`COMMIT` eksplisit +
  `PRAGMA foreign_keys = ON` sebelum menjalankan SQL migrasi, ditambah
  `PRAGMA foreign_key_check` setelahnya) dan sudah diuji visual langsung
  di aplikasi (`tauri dev`) — transaksi baru tersimpan dengan
  `account_id`/`category_id` utuh, foto lampiran tersimpan dan terbaca
  benar.

  **Pelajaran**: verifikasi migrasi SQLite yang melibatkan FK harus
  mereplikasi konteks eksekusi sqlx yang sesungguhnya (transaksi tunggal
  + FK ON), bukan sekadar menjalankan file `.sql` apa adanya lewat CLI —
  keduanya bisa memberi hasil yang sangat berbeda.

### 2. Pola migration "copy-and-rename" belum punya template tertulis

`0004_allow_transfer_type.sql` menunjukkan pola nyata untuk menambah
varian `CHECK` constraint (SQLite tidak izinkan `ALTER TABLE ... CHECK`
pada constraint yang sudah ada) — bikin tabel `_new`, copy data, drop,
rename. Ini sudah diantisipasi secara naratif di
`docs/todos/plan/account-type.md` untuk `account_type` mendatang, tapi
belum ada file referensi/template SQL yang bisa langsung disalin saat
menulis migration serupa (mis. untuk `ON DELETE` di temuan #1 di atas,
yang juga butuh pola sama).

Kemungkinan arah: dokumentasikan pola ini di satu tempat (mis.
`docs/rules/` mengikuti pola `state-lifting-vs-context.md`) sebagai rule
tertulis "cara menambah/mengubah CHECK constraint di SQLite", supaya
migration berikutnya (untuk transfer type dulu, account_type nanti, atau
ON DELETE) tidak menulis ulang pola yang sama dari nol tiap kali.

### 3. Tidak ada test otomatis untuk migration

Ada 53 unit test untuk logic aplikasi (filter builder, pagination), tapi
tidak ada test yang menjalankan seluruh urutan migration SQL dan
memverifikasi skema akhir (kolom yang diharapkan ada, `CHECK` constraint
yang berlaku, index yang terbentuk). Migration adalah kode yang juga bisa
salah — typo SQL di migration berikutnya baru ketahuan saat app dijalankan
di device pengguna nyata, bukan saat development/CI.

Prioritas lebih rendah dari #1 dan #2 — worth dipertimbangkan kalau jumlah
migration terus bertambah dan risiko regresi skema makin nyata.

## Catatan

Temuan #1 levelnya SAMA dengan "delete tanpa konfirmasi" yang sudah
diperbaiki di `scalability-audit.md` — ini bug data-integrity nyata, bukan
sekadar preferensi arsitektur, karena bisa menyebabkan referensi rusak
tanpa peringatan apa pun ke pengguna. **Sudah dieksekusi** (lihat Temuan
#1 di atas) setelah keputusan `ON DELETE SET NULL` per relasi diambil,
konsisten dengan pola smart-delete yang sudah ada di UI.

Temuan #2 dan #3 masih terbuka.

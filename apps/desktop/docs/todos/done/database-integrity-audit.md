# Audit Integritas Skema Database

## Status & TODO saat ini (ringkas)

- [x] Temuan #1 — FK tidak ditegakkan sama sekali. Sudah dieksekusi
      (`0009_enforce_fk_set_null.sql` + `PRAGMA foreign_keys = ON` di
      `db.ts`), lihat detail di bawah.
- [x] Temuan #2 — pola migration "copy-and-rename" (sudah dipakai 5x:
      migration 0004, 0009, 0019, 0022, 0027). Ditulis 2026-10-05 jadi
      rule tertulis:
      [docs/rules/sqlite-copy-and-rename-migration.md](../../../rules/sqlite-copy-and-rename-migration.md),
      terdaftar di `apps/desktop/CLAUDE.md`.
- [x] Temuan #3 — belum ada test otomatis yang menjalankan seluruh
      urutan migration. Ditulis 2026-10-05: 3 test Rust di
      `src-tauri/src/migrations.rs` (`mod tests`), jalan lewat
      `cargo test --lib migrations`. Lihat detail & keterbatasan yang
      disadari di bawah.

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

### 2. Pola migration "copy-and-rename" belum punya template tertulis — SELESAI

**Status: dieksekusi 2026-10-05.** Lihat
[docs/rules/sqlite-copy-and-rename-migration.md](../../../rules/sqlite-copy-and-rename-migration.md),
terdaftar di `apps/desktop/CLAUDE.md`.

`0004_allow_transfer_type.sql` menunjukkan pola nyata untuk menambah
varian `CHECK` constraint (SQLite tidak izinkan `ALTER TABLE ... CHECK`
pada constraint yang sudah ada) — bikin tabel `_new`, copy data, drop,
rename. Audit ulang menemukan pola ini sudah dipakai di 5 migration
(0004, 0009, 0019, 0022, 0027), termasuk DUA bug nyata yang pernah
terjadi akibat urutan yang salah (`0009`: drop tabel lama sambil FK
`ON DELETE SET NULL` baru masih aktif menunjuk ke situ, meng-NULL-kan
data; `0022`: FK tabel lain yang tidak ikut direbuild tetap menunjuk ke
nama tabel `_old` yang sudah didrop). Rule yang ditulis mencakup kapan
pola sederhana (`_new`, satu tabel) cukup vs kapan wajib pakai pola
"rename semua dulu, baru drop semua di akhir" (kalau tabel yang diubah
direferensikan FK oleh tabel lain), plus cara verifikasi yang benar
(replikasi transaksi sqlx, bukan `sqlite3` CLI autocommit).

### 3. Tidak ada test otomatis untuk migration — SELESAI

**Status: dieksekusi 2026-10-05.** Lihat `src-tauri/src/migrations.rs`,
`mod tests` di bagian bawah file (dijalankan lewat `cargo test --lib
migrations` dari direktori `src-tauri/`).

Ada 53 unit test untuk logic aplikasi (filter builder, pagination), tapi
sebelumnya tidak ada test yang menjalankan seluruh urutan migration SQL.
Ditambahkan 3 test yang memanggil `migrations::get()` langsung (urutan
yang BENAR-BENAR dipakai app, bukan asumsi sort nama file) dan
menjalankannya ke koneksi `rusqlite` in-memory, mereplikasi konteks
eksekusi sqlx yang sesungguhnya (`PRAGMA foreign_keys = ON` di luar
transaksi test — rusqlite `execute_batch` per migration tidak
membungkusnya sendiri, konsisten dengan catatan di
[sqlite-copy-and-rename-migration.md](../../../rules/sqlite-copy-and-rename-migration.md)
soal PRAGMA jadi no-op di dalam transaksi):

1. `semua_migration_berhasil_dijalankan_dari_nol` — seluruh 33 migration
   jalan tanpa error SQL, lalu `PRAGMA foreign_key_check` harus kosong.
2. `skema_akhir_punya_tabel_dan_kolom_inti` — tabel & kolom kunci (mis.
   `accounts.is_active`, `transactions.account_id` bertipe TEXT/UUID
   pasca migrasi 0027) benar-benar ada di skema akhir.
3. `insert_baru_di_seluruh_rantai_fk_tidak_gagal` — INSERT nyata ke
   rantai FK penuh (`accounts` → `transactions` →
   `transaction_attachments`/`debts` → `debt_payments`) harus berhasil;
   test ini secara spesifik ditulis untuk menangkap kelas bug `0022`
   (FK tabel lain yang tidak ikut direbuild tetap menunjuk ke tabel
   `_old` yang sudah didrop — baru ketahuan saat ADA INSERT baru, bukan
   saat migration-nya sendiri dijalankan).

**Keterbatasan yang disadari (diverifikasi langsung saat menulis test
ini)**: ketiga test ini menjalankan SELURUH migration sampai versi
terbaru, jadi menguji state SKEMA AKHIR — bukan replay "bagaimana kalau
migration berhenti di versi X". Dicoba sengaja skip migration 0022
(filter sementara di loop test) untuk membuktikan test #3 menangkap
bug sejenisnya — hasilnya TETAP lolos, karena migration 0027
(beberapa versi setelah 0022) me-rebuild ulang SEMUA tabel termasuk
`debts`/`debt_payments` dari nol dengan FK yang benar, sehingga efek
bug 0022 "tertimpa" otomatis oleh 0027 di state akhir. Jadi test ini
efektif mendeteksi migration BARU yang menulis ulang pola ini secara
salah ke depan (skema akhir akan langsung rusak), TAPI tidak bisa
dipakai untuk memverifikasi riwayat historis tiap versi migration satu
per satu — itu di luar scope yang wajar untuk test ini.

## Catatan

Temuan #1 levelnya SAMA dengan "delete tanpa konfirmasi" yang sudah
diperbaiki di `scalability-audit.md` — ini bug data-integrity nyata, bukan
sekadar preferensi arsitektur, karena bisa menyebabkan referensi rusak
tanpa peringatan apa pun ke pengguna. **Sudah dieksekusi** (lihat Temuan
#1 di atas) setelah keputusan `ON DELETE SET NULL` per relasi diambil,
konsisten dengan pola smart-delete yang sudah ada di UI.

Temuan #2 dan #3 sudah dieksekusi (lihat di atas). Semua temuan di
dokumen ini selesai.

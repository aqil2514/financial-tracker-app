# Audit Integritas Skema Database

## Latar belakang

Menyusul audit kode lintas fitur (`scalability-audit.md`) dan perbaikan
`ConfirmDeleteButton`, dilakukan tinjauan ke sisi skema SQLite
(`src-tauri/migrations/*.sql`) untuk mencari risiko integritas data yang
setara dengan "delete tanpa konfirmasi" — bug korektnes yang bisa
menyebabkan kehilangan/korupsi data, bukan sekadar soal reuse kode.

## Temuan

### 1. Foreign key TIDAK ditegakkan sama sekali (prioritas tertinggi)

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

**Kemungkinan arah perbaikan (belum diputuskan)**:
- Aktifkan `PRAGMA foreign_keys = ON` per koneksi (biasanya lewat opsi
  koneksi `tauri-plugin-sql` atau dijalankan sekali saat `getDb()`) — TAPI
  ini mengubah perilaku delete secara signifikan: begitu diaktifkan, hapus
  kategori/akun yang masih dipakai transaksi akan GAGAL (constraint
  violation) alih-alih silently orphan, kecuali FK-nya didefinisikan
  ulang dengan `ON DELETE SET NULL`/`CASCADE` eksplisit di migration
  berikutnya (butuh migration "copy-and-rename" seperti pola
  `0004_allow_transfer_type.sql`, karena SQLite tidak bisa `ALTER
  TABLE` FK constraint pada tabel yang sudah ada).
- Perlu diputuskan per relasi, `ON DELETE` seperti apa yang benar secara
  bisnis: `transactions.category_id`/`account_id` mungkin lebih masuk akal
  `SET NULL` (transaksi historis tetap ada, tapi kategorinya jadi
  "tidak diketahui") daripada `CASCADE` (menghapus akun otomatis
  menghapus semua transaksinya — kemungkinan besar TIDAK diinginkan untuk
  app finance, karena riwayat finansial semestinya tidak boleh hilang
  begitu saja).
- Sebelum mengaktifkan enforcement, sebaiknya cek dulu apakah sudah ada
  data orphan di database pengguna existing (termasuk dari hasil import
  Money Manager) — mengaktifkan FK enforcement pada database yang sudah
  punya orphan reference akan menyebabkan migration/query berikutnya
  gagal.

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
tanpa peringatan apa pun ke pengguna. Belum dieksekusi karena keputusan
`ON DELETE` per relasi (SET NULL vs CASCADE vs RESTRICT) berdampak ke
perilaku bisnis yang perlu dipastikan dulu sebelum mengubah skema —
bukan keputusan teknis semata.

# Optimalisasi Import: Deskripsi Detail (ZDATA) dan Foto Transaksi Hilang

## Latar belakang

Saat membandingkan skema `transactions` (9 kolom) dengan tabel sumber
Money Manager `INOUTCOME` (33 kolom, lihat
`internal/backups/MMAuto[GF260916](16-09-26-043837).mmbak`), ditemukan dua
jenis data yang ada di sumber tapi TIDAK ikut dipindahkan oleh
`import_money_manager` (`src-tauri/src/import/money_manager/source/queries.rs`).

## Temuan 1: kolom `ZDATA` (deskripsi detail) tidak pernah di-query

Money Manager punya DUA field teks terpisah per transaksi:
- `ZCONTENT` — lebih mirip judul/ringkasan singkat (mis. "Hadiah", "Pulsa",
  "Duit Lebaran"). Ini yang di-mapping ke `note` di aplikasi ini.
- `ZDATA` — deskripsi detail yang sebenarnya, kadang multi-baris (mis.
  transaksi "Duit Lebaran" punya ZDATA "Nde Mursan 10k\nMang Ijai
  10k\nCing Indah 10k"; transaksi "Pulsa" punya ZDATA "Aji pulsa XL 100k").

Query `load_income_expense`/`load_transfer_out`/`load_transfer_in` di
`queries.rs` HANYA mengambil `ZCONTENT` — `ZDATA` sama sekali tidak
disertakan dalam `SELECT`. Terkonfirmasi lewat query langsung ke
`.mmbak`: 262 dari 7704 baris `INOUTCOME` punya `ZDATA` terisi
(`WHERE ZDATA IS NOT NULL AND ZDATA != ''`). Detail sebanyak itu hilang
diam-diam saat import — bukan error, tapi kehilangan informasi tanpa
disadari.

## Temuan 2: foto bukti transaksi (tabel `PHOTO`) tidak ada padanannya

Money Manager punya tabel `PHOTO` terpisah, dihubungkan ke transaksi lewat
`txUid` (foreign key ke `INOUTCOME.uid`), relasi one-to-many (satu
transaksi bisa punya beberapa foto). Backup `.mmbak` yang diperiksa punya
29 baris di tabel ini. Skema `transactions` di aplikasi ini tidak punya
kolom atau tabel terkait sama sekali untuk lampiran/foto — baik untuk
import maupun untuk fitur tambah foto manual ke depannya.

Kolom tabel `PHOTO`: `DEVICE_ID`/`uid` (id), `IS_DEL` (soft-delete),
`USETIME` (timestamp), `txUid` (FK ke transaksi), `FILE_SIZE`,
`FILE_PATH`/`FILE_NAME` (lokasi file saat disimpan Money Manager, mis.
`/storage/emulated/0/Pictures/MoneyManager/<uuid>.png`),
`ORG_FILE_PATH`/`ORG_FILE_NAME` (lokasi file ASLI sebelum diproses Money
Manager, mis. `/storage/emulated/0/DCIM/Camera/MM_20241110_174916_0_.jpg`
atau path picker Android), plus metadata sync (`isSynced`, dst).

**Update — folder `Pictures/MoneyManager/` di HP memang berisi foto
dengan nama UUID** (dikonfirmasi lewat screenshot file manager, HP
Infinix HOT 40 Pro) yang cocok dengan `FILE_NAME`/`uid` di tabel `PHOTO`
— secara teori BISA dicocokkan balik ke transaksi lewat `PHOTO.txUid` →
`INOUTCOME`. TAPI ada kejanggalan penting yang mengubah kesimpulan ini.

**Fitur "Ekspor File Foto" bawaan Money Manager sendiri tidak bisa
diandalkan** (dikonfirmasi lewat pengujian langsung di HP): menu
Cadangan → "Ekspor File Foto" → pilih beberapa foto (contoh: 20 foto) →
Ekspor → muncul dialog "Salin foto di aplikasi ke folder khusus" dengan
instruksi pilih folder tujuan (mis. `Pictures/MoneyManager` atau folder
lain) → Konfirmasi → toast "Foto telah disalin." muncul, tapi setelah
folder tujuan itu dicek, FILE TIDAK ADA DI SANA. Aplikasi mengklaim
sukses tapi penyalinan tidak benar-benar terjadi.

Implikasi: folder `Pictures/MoneyManager/` yang berisi file UUID itu
kemungkinan besar adalah lokasi PENYIMPANAN INTERNAL asli Money Manager
(tempat foto pertama kali disimpan saat difoto/dipilih di form transaksi
dulu), BUKAN hasil dari fitur "Ekspor" — fitur ekspornya sendiri rusak/
tidak berfungsi, jadi tidak bisa dipakai sebagai cara resmi mengeluarkan
foto ke lokasi lain untuk ditransfer ke PC. Untungnya folder aslinya
(`Pictures/MoneyManager/`) tetap bisa diakses langsung lewat file manager
Android biasa (seperti pada screenshot) — jadi foto tetap bisa diambil
manual (salin folder itu langsung via USB/file manager/cloud), hanya saja
TIDAK lewat fitur ekspor resmi aplikasi yang ternyata tidak berfungsi.

Untuk keperluan import ke aplikasi ini: proses tetap butuh AKSES KE
FOLDER FOTO DI DEVICE (bukan cuma file `.mmbak` sendirian) — beda dengan
`INOUTCOME`/`ASSETS` yang seluruhnya sudah ada di dalam database. Alur
importnya perlu diperluas: user pilih file `.mmbak` DAN folder foto (yang
sudah ditransfer manual ke PC dari `Pictures/MoneyManager/` di HP, TANPA
mengandalkan fitur "Ekspor File Foto" Money Manager), lalu proses import
mencocokkan tiap file di folder itu ke `PHOTO.FILE_NAME`/`uid` untuk tahu
transaksi tujuannya.

## Kemungkinan arah perbaikan (belum diputuskan)

**Untuk `ZDATA`**:
- Gabung ke `note` saat import, mis. format `"{ZCONTENT}: {ZDATA}"` atau
  `"{ZCONTENT}\n{ZDATA}"` — paling sederhana, tidak perlu ubah skema, tapi
  kehilangan pemisahan semantik judul vs detail.
- Tambah kolom baru `description` (atau nama lain) di `transactions`,
  terpisah dari `note` — mempertahankan struktur asli Money Manager, tapi
  perlu migrasi skema dan keputusan UI (field baru di form transaksi).

**Untuk foto** (sudah dikonfirmasi filenya MASIH ADA di
`Pictures/MoneyManager/` di device Android):
- Tabel baru `transaction_attachments` (`transaction_id`, `file_path`,
  dst) untuk menyimpan referensi foto per transaksi di aplikasi ini.
- Alur import perlu diperluas: selain file `.mmbak`, user juga perlu
  arahkan ke folder foto (`Pictures/MoneyManager/`) — Tauri punya akses
  file system jadi ini secara teknis memungkinkan (dialog pilih folder,
  bukan cuma pilih file). Proses import lalu: baca tabel `PHOTO` dari
  `.mmbak` → dapat `uid`/`FILE_NAME` per transaksi (`txUid`) → cari file
  dengan nama itu di folder yang dipilih → salin ke storage aplikasi
  sendiri (App data dir Tauri) → simpan referensinya di
  `transaction_attachments`.
- Kalau device sumbernya bukan device yang sama dengan yang menjalankan
  aplikasi desktop ini (kemungkinan besar — ini app desktop, foto ada di
  HP Android), user perlu transfer folder itu ke PC dulu (USB/cloud) baru
  bisa diarahkan saat import — bukan sesuatu yang bisa otomatis diakses
  langsung dari desktop app tanpa langkah manual itu.

Kedua arah ini BUTUH keputusan skema (kolom/tabel baru) sebelum
diimplementasikan — beda dengan `import-category-dedup.md` yang bisa
diperbaiki di level query import tanpa ubah skema.

## Catatan

Data yang SUDAH ter-import (7704 transaksi) tidak akan otomatis dapat
`ZDATA`/foto kalau perbaikan ini baru dikerjakan nanti — perlu re-import
atau migrasi terpisah untuk data lama, sama seperti pertimbangan risiko di
`import-category-dedup.md`. Untuk saat ini dibiarkan apa adanya, dicatat
supaya tidak terlupa saat proses import ditinjau ulang.

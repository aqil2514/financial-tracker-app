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

## Status implementasi (foto/lampiran)

**Keputusan yang sudah diambil**:
- Tabel baru `transaction_attachments` (bukan kolom tunggal di
  `transactions`), karena relasinya one-to-many — satu transaksi bisa
  punya beberapa foto, sama seperti tabel `PHOTO` di Money Manager.
- `ON DELETE CASCADE` dari `transactions.id` (BUKAN `SET NULL` seperti
  relasi lain di `database-integrity-audit.md`) — foto tidak punya makna
  tanpa transaksi induknya, jadi wajar ikut hilang (baris DB-nya) saat
  transaksi dihapus.
- File fisik disimpan di app data dir (`<app_data_dir>/attachments/`)
  secara default, tapi user nantinya bisa pilih folder kustom sendiri —
  disimpan sebagai key di tabel `settings` yang sudah ada di skema
  (belum diimplementasikan di sisi frontend).
- Cakupan fitur diperluas: bukan cuma target hasil import Money Manager,
  tapi juga fitur baru — user bisa attach foto manual ke transaksi lewat
  tiga cara: dialog pilih file OS, drag & drop, dan paste dari clipboard.
- Tampilan foto (di form transaksi, list, dll) SENGAJA belum diputuskan —
  kemungkinan ada perombakan action card transaksi terlebih dahulu, jadi
  UI ditunda supaya tidak dibangun dua kali.

**Sudah dikerjakan dan diverifikasi**:
- Migration `0010_transaction_attachments.sql` — tabel
  `transaction_attachments` (`transaction_id`, `file_path`, `created_at`)
  + index `idx_transaction_attachments_transaction`. Diverifikasi lewat
  `sqlite3` CLI: migrasi jalan bersih, dan `ON DELETE CASCADE` terbukti
  bekerja (hapus transaksi → baris attachment terkait otomatis lenyap).
- Rust command baru di `src-tauri/src/attachments/mod.rs`, didaftarkan di
  `lib.rs`:
  - `save_attachment_bytes` — simpan bytes (untuk hasil paste clipboard,
    yang tidak punya path file sumber) ke folder tujuan (default atau
    kustom), nama file di-generate UUID supaya tidak pernah tabrakan.
  - `save_attachment_from_path` — salin file dari path sumber (untuk
    dialog pilih file dan drag & drop, yang keduanya memberi path native).
  - `read_attachment_bytes` — baca isi file jadi bytes, untuk ditampilkan
    sebagai preview di WebView nanti (dikonversi ke data URL) — karena
    WebView tidak bisa akses filesystem lokal langsung.
  - `delete_attachment_file` — hapus file fisik dari disk. Terpisah dari
    penghapusan baris DB (yang bisa terjadi otomatis lewat CASCADE) karena
    CASCADE cuma membersihkan database, bukan file di storage.
  - Dependency baru: `uuid` (fitur `v4`) di `Cargo.toml`.
  - Dicek: command custom Tauri (bukan command dari plugin) tidak perlu
    entry permission tambahan di `capabilities/default.json` — hanya
    command dari plugin yang butuh ACL eksplisit.
- `cargo check` bersih tanpa warning, 66 test frontend tetap lulus (tidak
  ada perubahan sisi frontend di tahap ini).

**Frontend — hooks & komponen generik** (`src/features/attachments/`):
- `use-attachment-folder.ts` — baca/tulis folder kustom lewat tabel
  `settings` (key `attachment_folder`), `null`/kosong berarti pakai
  default app data dir.
- `use-transaction-attachments.ts` — list lampiran per transaksi.
- `use-add-attachment.ts` — `saveFile` (pilih command Rust yang tepat
  berdasar `source: "path" | "bytes"`, diexport untuk testing/reuse),
  `saveAttachmentToTransaction` (versi non-hook, dipakai di luar konteks
  mutation UI biasa), dan `useAddAttachment` (mutation biasa untuk mode
  edit).
- `use-delete-attachment.ts` — hapus baris DB + file fisik (gagal hapus
  file tidak menggagalkan hapus baris — tujuannya melepas lampiran dari
  transaksi, bukan menjaga file selalu ada).
- `use-attachment-capture.ts` — logic PENANGKAPAN input (dialog pilih
  file, drag & drop via `getCurrentWebview().onDragDropEvent()` — BUKAN
  HTML5 drag-drop biasa, karena WebView Tauri tidak mengisi `File.path`
  sehingga posisi kursor dicocokkan manual ke area dropzone; dan paste
  clipboard via `@tauri-apps/plugin-clipboard-manager`, RGBA dikonversi
  ke PNG lewat Canvas) — diekstrak terpisah dari logic PENYIMPANAN supaya
  dipakai bersama oleh kedua mode uploader di bawah.
- `attachment-thumbnail.tsx` — render preview dari `file_path` tersimpan
  (baca bytes via `read_attachment_bytes` → base64 → data URL, di-chunk
  per 8192 byte supaya tidak O(n²) untuk foto besar).
- `attachment-uploader.tsx` (`AttachmentUploader`) — mode DB langsung,
  untuk transaksi yang SUDAH punya id (form edit).
- `pending-attachment.ts` + `pending-attachment-uploader.tsx`
  (`PendingAttachmentUploader`) — mode buffer memori untuk transaksi yang
  BELUM punya id (form tambah): foto ditangkap dan langsung dipreview
  lewat `URL.createObjectURL`, TANPA menyentuh disk/database sama sekali,
  sampai transaksi induknya berhasil disimpan.
- Dependency baru: `@tauri-apps/plugin-clipboard-manager` (JS) +
  `tauri-plugin-clipboard-manager` (Rust crate), didaftarkan di `lib.rs`
  dan `capabilities/default.json`.
- 14 unit test baru (`attachment-thumbnail.test.ts`,
  `use-add-attachment.test.ts`) menguji `guessMimeType`/`bytesToDataUrl`
  (termasuk kasus data besar yang melewati batas chunk) dan `saveFile`
  (command yang benar terpanggil sesuai `source`, `Uint8Array` dikonversi
  ke `Array` biasa untuk serialisasi IPC).

**Terpasang ke form transaksi** (`src/features/transactions/form/`):
- `TransactionForm` menerima `transactionId` (mode edit → `AttachmentUploader`)
  ATAU `pendingAttachments`/`onPendingAttachmentsChange` (mode create →
  `PendingAttachmentUploader`), dirender sebagai section terpisah di
  bawah field Catatan.
- `useEntityForm`/`useDbMutation` diberi opsi `onSuccess` baru (opsional,
  backward-compatible untuk 8 pemakaian lain) supaya
  `use-create-transaction.ts` bisa memproses pending attachments SETELAH
  insert transaksi berhasil dan `transaction_id`-nya diketahui — SQLite
  `execute()` sudah mengembalikan `lastInsertId` langsung tanpa perlu
  `RETURNING`/`select()` terpisah.
- Kegagalan menyimpan lampiran DITANGANI TERPISAH dari kegagalan
  menyimpan transaksi (try-catch + toast sendiri di `onSuccess`) —
  `useDbMutation`'s `onError` cuma menangkap error dari `mutationFn`,
  bukan dari callback `onSuccess`, jadi tanpa penanganan ini kegagalan
  simpan foto akan jadi unhandled rejection yang diam-diam gagal tanpa
  feedback ke user. Pending attachments tetap dibersihkan (state +
  `revokeObjectURL`) baik sukses maupun gagal sebagian, karena form sudah
  ikut ter-reset dan tidak bisa "dicoba ulang" dari state yang sama.
- `TransactionFormDialog` menyimpan `pendingAttachments` sebagai state,
  dibaca lewat `ref` (bukan snapshot) di dalam `mutationFn`/`onSuccess`
  supaya selalu memakai nilai terbaru saat submit terjadi.

**Sudah diuji visual di aplikasi (`tauri dev`) dan berfungsi**:
- Simpan lampiran lewat form Tambah transaksi (mode buffer/pending) —
  transaksi tersimpan dengan benar, foto ikut tersimpan ke disk +
  `transaction_attachments` setelah `transaction_id` diketahui.
- Ketiga cara capture foto: dialog pilih file, drag & drop, paste
  clipboard (screenshot/copy image) — lihat "Bug ditemukan saat testing
  visual" di bawah untuk perbaikan yang diperlukan sebelum ketiganya
  benar-benar bekerja.
- UI pengaturan folder kustom sudah dipasang: card "Folder Lampiran Foto"
  di halaman Settings (`attachment-folder-setting.tsx`) — menampilkan
  folder aktif (default/kustom), tombol pilih folder lain (native folder
  picker) dan reset ke default. Command Rust baru
  `get_default_attachment_dir` ditambahkan supaya path default bisa
  ditampilkan sebagai informasi. Mengubah folder TIDAK memindahkan file
  lampiran lama yang sudah tersimpan.

**Bug ditemukan saat testing visual, sudah diperbaiki**:
1. **Migrasi 0009 (`enforce_fk_set_null`) gagal total secara silent di
   production** — `no such table: transaction_attachments` muncul
   meski migrasi "sukses" menurut testing manual sebelumnya. Dua lapis
   bug berbeda, ditemukan berurutan:
   - **Lapis 1**: `PRAGMA foreign_keys = OFF/ON` di awal/akhir migrasi
     tidak berpengaruh sama sekali — SQLite meng-abaikan PRAGMA ini kalau
     dijalankan di dalam transaksi aktif, dan sqlx migrator (dipakai
     `tauri-plugin-sql`) SELALU membungkus tiap migrasi dalam satu
     transaksi tanpa opsi menonaktifkannya. Testing manual sebelumnya
     lewat `sqlite3` CLI memberi hasil palsu-positif karena CLI
     menjalankan tiap statement secara autocommit (independen), bukan
     dalam satu transaksi besar seperti sqlx — jadi PRAGMA-nya betulan
     berpengaruh di situ, beda dari kondisi nyata di aplikasi.
   - **Lapis 2** (muncul setelah lapis 1 diperbaiki): urutan "proses
     tabel satu-per-satu sampai selesai (create+insert+drop+rename), baru
     lanjut ke tabel berikutnya" — meski diurutkan dari yang paling
     sedikit direferensikan — TETAP salah. Begitu `transactions` selesai
     di-rename dan sudah punya FK `ON DELETE SET NULL` ke `accounts`,
     `DROP TABLE accounts` berikutnya membuat SQLite (dengan FK aktif)
     memperlakukannya seolah menghapus semua baris `accounts` satu per
     satu — trigger `ON DELETE SET NULL` di `transactions.account_id`
     benar-benar tereksekusi, meng-NULL-kan SELURUH `account_id` yang
     ada, walau `accounts` langsung digantikan tabel baru berisi data
     identik. Diperbaiki dengan pola berbeda: rename SEMUA tabel lama ke
     nama sementara (`_old`) dan drop SEMUA index lama-nya di awal, baru
     buat semua tabel baru + salin data, dan baru drop semua tabel `_old`
     di paling akhir — supaya tidak pernah ada momen sebuah tabel
     di-drop selagi ada FK `ON DELETE SET NULL` yang sudah aktif menunjuk
     ke situ. Diverifikasi lewat replikasi manual transaksi sqlx yang
     sesungguhnya (`BEGIN`/`COMMIT` + `PRAGMA foreign_keys = ON`) plus
     `PRAGMA foreign_key_check` bersih.
2. **Base UI console error**: `Button` (base-ui) dengan `render={<Link />}`
   di `recent-transactions-card.tsx` memicu warning "expected a native
   `<button>`" karena `Link` Next.js merender `<a>`, bukan `<button>`.
   Diperbaiki dengan `nativeButton={false}`.
3. **Paste clipboard gagal (permission)**: `clipboard-manager:default`
   TIDAK mengaktifkan permission apa pun (plugin ini sengaja default-deny
   semua fitur demi keamanan) — `readImage()` selalu ditolak sampai
   `clipboard-manager:allow-read-image` ditambahkan eksplisit ke
   `capabilities/default.json`.
4. **Paste clipboard gagal (format tidak didukung)**: setelah permission
   diperbaiki, paste hasil Ctrl+C FILE di File Explorer tetap gagal
   dengan "clipboard contents were not available in the requested
   format" — Windows menaruh referensi path (`CF_HDROP`) untuk file yang
   di-copy dari Explorer, bukan data bitmap, dan `readImage()` hanya bisa
   membaca bitmap asli (hasil screenshot atau "Copy image" di
   browser/image viewer). Diputuskan TIDAK menambah dukungan baca
   `CF_HDROP` (di luar cakupan plugin clipboard-manager yang ada, perlu
   command Rust custom) — cukup perjelas pesan error dan teks bantuan
   supaya user tahu memakai tombol "Tambah"/drag & drop untuk kasus file
   dari Explorer.
5. **Drag & drop tidak pernah terdeteksi ("dropzone tidak terlihat
   aktif")**: `event.payload.position` dari `onDragDropEvent` Tauri dalam
   PHYSICAL pixels, sedangkan `getBoundingClientRect()` DOM dalam
   LOGICAL/CSS pixels — di layar dengan DPI scaling (umum di Windows,
   mis. 125%/150%) keduanya tidak pernah cocok kalau dibandingkan
   langsung, sehingga `isInside()` selalu `false`. Diperbaiki dengan
   membagi `window.devicePixelRatio` pada koordinat sebelum dibandingkan.

**Belum dikerjakan** (lanjutan, disengaja ditunda per keputusan terakhir):
- Alur import dari Money Manager untuk memindahkan foto lama (folder
  `Pictures/MoneyManager/` di device + tabel `PHOTO` di `.mmbak`) ke
  tabel `transaction_attachments` yang baru ini.
- Tampilan foto di tempat LAIN (list transaksi, dsb.) masih menunggu
  pembahasan perombakan action card transaksi — saat ini foto hanya
  terlihat di form tambah/edit.

## Kemungkinan arah perbaikan (belum diputuskan, untuk ZDATA/deskripsi)

**Untuk `ZDATA`**:
- Gabung ke `note` saat import, mis. format `"{ZCONTENT}: {ZDATA}"` atau
  `"{ZCONTENT}\n{ZDATA}"` — paling sederhana, tidak perlu ubah skema, tapi
  kehilangan pemisahan semantik judul vs detail.
- Tambah kolom baru `description` (atau nama lain) di `transactions`,
  terpisah dari `note` — mempertahankan struktur asli Money Manager, tapi
  perlu migrasi skema dan keputusan UI (field baru di form transaksi).

**Untuk foto**: skema dan command penyimpanan file sudah dieksekusi —
lihat "Status implementasi (foto/lampiran)" di atas. Alur import dari
`Pictures/MoneyManager/` + tabel `PHOTO` masih seperti dijelaskan di
Temuan 2 (folder foto perlu ditransfer manual ke PC dulu, fitur "Ekspor
File Foto" bawaan Money Manager tidak bisa diandalkan) dan belum
dikerjakan — proses import nanti: baca tabel `PHOTO` dari `.mmbak` →
dapat `uid`/`FILE_NAME` per transaksi (`txUid`) → cari file dengan nama
itu di folder yang dipilih user → panggil `save_attachment_from_path` →
simpan referensinya di `transaction_attachments`.

`ZDATA`/deskripsi BUTUH keputusan skema (kolom baru) sebelum
diimplementasikan — beda dengan `import-category-dedup.md` yang bisa
diperbaiki di level query import tanpa ubah skema.

## Catatan

Data yang SUDAH ter-import (7704 transaksi) tidak akan otomatis dapat
`ZDATA`/foto kalau perbaikan ini baru dikerjakan nanti — perlu re-import
atau migrasi terpisah untuk data lama, sama seperti pertimbangan risiko di
`import-category-dedup.md`. Untuk saat ini dibiarkan apa adanya, dicatat
supaya tidak terlupa saat proses import ditinjau ulang.

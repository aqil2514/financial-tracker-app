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

**Update — sumber foto asli ditemukan lewat draft Gmail otomatis Money
Manager**: draft kosong (tanpa subjek/isi) di akun Gmail pribadi ternyata
punya belasan lampiran foto UUID — hasil fitur backup terjadwal Money
Manager yang mengirim ke diri sendiri via draft (bukan email terkirim).
Lampiran itu TIDAK bisa diakses langsung lewat MCP Gmail yang dipakai di
sini (`get_draft`/`list_drafts` tidak mengekspos field `attachments` untuk
draft, dan mode `RAW` gagal karena kemungkinan ukuran gabungan lampiran
kebesaran) — user mengunduh manual lalu mengarsipkannya sebagai
`internal/MoneyManager.7z` (20 file, format nama UUID cocok dengan
`PHOTO.FILE_NAME`). Proses pencocokan & pemasangan sudah dikerjakan (lihat
di bawah), bukan lewat alur import formal, sama seperti pendekatan ZDATA.

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
  (frontend-nya sudah diimplementasikan, lihat "UI pengaturan folder
  kustom" di bagian "Sudah diuji visual" di bawah).
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

**Frontend — hooks & komponen generik** (`src/shared/attachments/` —
dipindah dari `src/features/attachments/` saat perapian struktur folder
`features/` vs `shared/`, lihat catatan folder di bawah):
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

## Foto lama dari Money Manager: sudah dipasang ke 20 transaksi

Sama seperti ZDATA, dikerjakan lewat script pencocokan sekali jalan
(bukan alur import formal) setelah 20 file foto asli berhasil didapat
dari `internal/MoneyManager.7z` (lihat "Update — sumber foto asli
ditemukan lewat draft Gmail" di atas):
- Pencocokan pakai `PHOTO.txUid` → `INOUTCOME` untuk dapat
  `(tanggal, tipe, nominal, catatan)` tiap foto, lalu dicocokkan ke
  `transactions` dengan kombinasi yang sama persis seperti pencocokan
  ZDATA. Pasangan transfer (`DO_TYPE` 3 & 4) yang menunjuk foto dan
  detail transaksi identik dideduplikasi dulu (satu foto untuk satu baris
  `type = 'transfer'`), sama seperti pola dedup ZDATA.
- Dari 29 baris `PHOTO` (tidak terhapus) di sumber, cuma 20 file yang
  benar-benar tersedia di archive — sisanya (5 nama file unik) tidak ada
  filenya sama sekali di `MoneyManager.7z` sehingga tidak bisa diproses.
  Ke-20 file itu SEMUANYA berhasil dicocokkan ke satu `transaction_id`
  unik (tidak ada yang ambigu atau tanpa match).
- Diterapkan ke `finance.dev.db` DAN `finance.db` (prod), masing-masing
  dibackup dulu: file fisik disalin ke folder `<app_data_dir>/attachments/`
  bersama (satu folder dipakai dev & prod) dengan nama di-generate UUID
  baru — pola identik dengan upload manual lewat `save_attachment_from_path`
  — lalu baris `transaction_attachments` di-insert menunjuk ke situ.
  Karena file fisiknya sudah tersalin sekali saat proses dev, proses ke
  prod tinggal insert baris DB yang reuse `file_path` yang sama (tidak
  menyalin file dua kali) — dicocokkan lewat `transaction_id` yang sama
  persis antara dev & prod (datanya identik, historis).
- Hasil dikonfirmasi valid: file JPEG/PNG asli (bukan corrupt), jumlah
  baris `transaction_attachments` bertambah tepat 20 di kedua database,
  tidak ada transaksi yang sebelumnya sudah punya lampiran jadi tertimpa.

## Status implementasi (kolom `description`/ZDATA)

**Keputusan yang sudah diambil**: kolom baru `description` (bukan gabung
ke `note`) — mempertahankan pemisahan semantik Money Manager
(`ZCONTENT` = judul singkat → `note`, `ZDATA` = detail → `description`).
`note` tetap plain text, HANYA `description` yang jadi rich text.
Rich text pakai Tiptap, mulai dari core saja (`StarterKit` — bold,
italic, strikethrough, heading, list, blockquote — tanpa ekstensi lanjutan
seperti table/image/mention). Data transaksi LAMA (7704 baris hasil
import sebelumnya) TIDAK di-re-import — kolom baru ini kosong (`NULL`)
untuk semuanya, hanya transaksi baru ke depannya yang bisa mengisinya
lewat form. Alur re-import `ZDATA` dari `.mmbak` untuk data lama BELUM
dikerjakan (lihat "Belum dikerjakan" di bawah).

**Sudah dikerjakan dan diverifikasi**:
- Migration `0011_transaction_description.sql` — `ALTER TABLE
  transactions ADD COLUMN description TEXT` (nullable). Jauh lebih
  sederhana dari migrasi 0009 (bukan copy-and-rename), tapi tetap
  diverifikasi dengan replikasi transaksi sqlx yang benar (`BEGIN`/
  `COMMIT` + `PRAGMA foreign_keys = ON`) mengikuti pelajaran dari bug
  0009 — aman, tidak ada DROP TABLE yang bisa memicu FK cascade.
- Package baru: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`
  (core Tiptap), `@tailwindcss/typography` (untuk styling `prose` pada
  konten rich text) — didaftarkan lewat `@plugin "@tailwindcss/typography"`
  di `globals.css` (Tailwind v4, CSS-based config).
- `src/components/rich-text/`: `rich-text-editor.tsx` (`RichTextEditor`,
  editor dengan toolbar bold/italic/strikethrough/bullet-list/
  ordered-list/blockquote), `rich-text-viewer.tsx` (`RichTextViewer`,
  render read-only), `is-empty-doc.ts` (`isEmptyDoc` —
  deteksi dokumen Tiptap "kosong" secara struktural, bukan cuma
  truthy-check, supaya tidak menyimpan `{"type":"doc","content":
  [{"type":"paragraph"}]}` sebagai "terisi").
- `src/components/form-fields/form-field-rich-text.tsx`
  (`FormFieldRichText`) — wrapper react-hook-form, pola sama seperti
  `FormFieldTextarea`/dkk lain.
- Disimpan sebagai `JSON.stringify` dokumen Tiptap di kolom
  `description` (`TEXT`), dibaca balik lewat `JSON.parse` saat form edit
  dibuka. `isEmptyDoc` dicek sebelum simpan — dokumen kosong disimpan
  sebagai `NULL`, bukan JSON kosong.
- Terpasang di `TransactionForm` (create & edit), field "Deskripsi" di
  kolom kanan grid (lihat "Layout form transaksi" di bawah).

**Sudah dipasang untuk display** (setelah perombakan action card jadi
`ListItemActionsMenu` generik):
- `TransactionDetailDialog` (`features/transactions/list/`) — dialog
  read-only "Lihat Detail" dari menu aksi transaksi.
- `DetailTab` (`features/accounts/dialogs/detail-dialog/right-side/`) —
  tab Detail di dialog detail akun, untuk transaksi yang dipilih dari
  tab Terbaru/Bulan Ini.

**Sudah dikerjakan — isi manual `ZDATA` untuk transaksi lama (bukan alur
import baru, cukup pencocokan sekali jalan)**:
- Diputuskan TIDAK membangun alur re-import formal (pilih file `.mmbak`
  lagi lewat UI import) — cukup script sekali pakai yang mencocokkan 262
  baris `ZDATA` dari backup terbaru (`MMAuto[GF260918](18-09-26-045151).mmbak`)
  ke transaksi yang SUDAH ada di `transactions`, lalu `UPDATE description`
  langsung by `id`. Lebih murah daripada bikin alur import formal untuk
  kasus satu kali ini.
- Pencocokan pakai kombinasi `(tanggal, tipe, nominal, catatan)` — 262
  baris ZDATA mentah terdiri dari 154 income/expense + 108 baris
  transfer (54 pasang `transfer_out`/`transfer_in` Money Manager yang
  deskripsinya identik per pasang). Karena skema aplikasi ini menyimpan
  satu transfer sebagai SATU baris `type = 'transfer'` (bukan dua baris
  terpisah seperti Money Manager), pasangan transfer identik dideduplikasi
  dulu sebelum dicocokkan — jadi penyebut sebenarnya 208 unit (154 + 54),
  bukan 262.
- Hasil: **199 dari 208 unit (96%) berhasil dicocokkan otomatis** dan
  langsung di-`UPDATE` ke kolom `description` — diterapkan ke
  `finance.dev.db` DAN `finance.db` (prod), masing-masing dibackup dulu
  sebelum diubah. Deskripsi disimpan sebagai dokumen Tiptap JSON (bukan
  teks polos) — teks ZDATA multi-baris dipecah jadi beberapa node
  `paragraph` terpisah, diverifikasi valid dan bisa dirender
  `RichTextViewer` tanpa error.
- **9 unit (63 baris ZDATA mentah kalau dihitung sebelum dedup) tidak
  cocok otomatis**, dibiarkan kosong untuk diisi manual lewat form edit
  transaksi:
  - 4 pasang transfer "Jasa Tukang"/"Rak Susun"/"Alat Olahraga" yang di
    DB ternyata tersimpan sebagai `type = 'expense'` dengan
    `transfer_account_id` ikut terisi (bukan `type = 'transfer'` murni)
    — kasus tidak umum, kemungkinan hasil edit manual sebelumnya, di luar
    pola pencocokan standar.
  - 4 transaksi "Selisih saldo" bertanggal 2026-04-29 yang nominalnya di
    DB sudah tergabung/dijumlah berbeda dari nominal per-baris di sumber
    `.mmbak`, sehingga tidak match by-nominal.
  - Daftar detail (tanggal, tipe, nominal, kategori, catatan, teks
    deskripsi lengkap) untuk SEMUA 262 baris awal — termasuk 9 unit yang
    belum terisi ini — didokumentasikan di checklist terpisah (artifact
    interaktif, di luar repo) untuk dicek/diisi manual satu-satu.

## Layout form transaksi (perombakan setelah lampiran + deskripsi ditambahkan)

Dialog Tambah/Edit Transaksi dirombak jadi grid 2 kolom (lebih lebar,
`sm:!max-w-4xl` — `!important` diperlukan karena default `DialogContent`
punya `sm:max-w-sm` yang bersaing pada breakpoint sama, lihat catatan di
bawah) supaya semua field baru (Deskripsi, Lampiran Foto) tidak membuat
dialog jadi sangat panjang ke bawah:
- **Kolom kiri**: Catatan (dipindah ke PALING ATAS, bertindak sebagai
  judul/title transaksi — sekarang `FormFieldText` input satu baris, BUKAN
  textarea, dan WAJIB diisi: `z.string().min(1, "Catatan wajib diisi")`,
  berubah dari opsional sebelumnya) → Tipe Transaksi → Nominal → Akun →
  Kategori/Ke Akun → Tanggal.
- **Kolom kanan**: Lampiran Foto (dibungkus `ScrollArea` dengan
  `max-h-48` supaya tidak memakan ruang vertikal berlebih walau foto
  banyak) di atas, Deskripsi (rich text) di bawahnya.
- `EntityFormDialog` (dipakai bersama semua entitas — akun, kategori,
  dst) diberi prop opsional baru `contentClassName` supaya dialog
  transaksi bisa lebih lebar dari default `sm:max-w-sm` TANPA mengubah
  lebar dialog entitas lain.
- **Catatan teknis (Tailwind v4 class override)**: `contentClassName`
  awalnya di-set `sm:max-w-3xl` tapi TIDAK berpengaruh sama sekali —
  root cause: Tailwind v4 meng-generate CSS berdasar urutan pertama
  kemunculan tiap class di seluruh source yang di-scan (bukan urutan di
  `className` string), dan kebetulan `sm:max-w-sm` (default
  `DialogContent`) muncul di CSS output SETELAH `sm:max-w-3xl`/`4xl` —
  keduanya sama-sama di breakpoint `sm:` dengan specificity identik,
  jadi yang terakhir di stylesheet yang menang, terlepas dari `cn()`/
  `tailwind-merge` sudah benar menghapus `sm:max-w-sm` dari string
  className (dikonfirmasi lewat test langsung). Diperbaiki dengan `!`
  modifier (`sm:!max-w-4xl`) untuk memaksa menang secara pasti.

## Filter transaksi baru (Deskripsi, Gambar)

Ditambahkan ke filter generik halaman Transaksi
(`list-card-header.tsx`/`use-transactions.ts`):
- **Deskripsi** (`type: "text"`): `LIKE` langsung terhadap kolom
  `description` (TEXT berisi JSON Tiptap) — tetap match karena teks isi
  tersimpan sebagai string biasa di dalam struktur JSON, meski secara
  teori bisa false-positive kalau kata kunci kebetulan cocok bagian
  struktur JSON (risiko sangat kecil untuk kata biasa).
- **Gambar** (`type: "select"`, key `has_attachment`, opsi "Ada
  gambar"/"Tidak ada gambar"): BUKAN kolom asli `transactions` (lampiran
  ada di tabel terpisah `transaction_attachments`), jadi tidak bisa
  lewat `buildWhereClause` generik yang mengasumsikan `filterKey` = nama
  kolom. Disaring lebih dulu di `use-transactions.ts`
  (`extractAttachmentCondition`) dan diterjemahkan jadi kondisi
  `EXISTS`/`NOT EXISTS (SELECT 1 FROM transaction_attachments WHERE
  transaction_attachments.transaction_id = transactions.id)` lewat
  mekanisme `extraConditions` yang sudah ada di `buildWhereClause`
  (sebelumnya cuma dipakai untuk filter tanggal kalender). Diverifikasi
  manual lewat `sqlite3`: jumlah baris "ada gambar" + "tidak ada gambar"
  cocok dengan total transaksi.
- Sempat diminta filter Gambar dibuat single-select (bukan multi-select
  seperti filter select lain), tapi diputuskan REVERT ke perilaku
  default (`FilterSelectInput` multi-select, konsisten dengan pola
  `is_active` di filter akun) karena tidak ada mekanisme single-select
  di komponen filter generik saat ini dan menambahkannya dianggap tidak
  sepadan untuk kasus ini — memilih dua opsi (Ada + Tidak ada) sekaligus
  secara efektif berarti tidak memfilter apa-apa, jadi tidak berbahaya
  dibiarkan sebagai multi-select.

## Indikator lampiran/deskripsi di list transaksi

`has_attachment` (subquery `EXISTS` yang sama dengan filter Gambar) juga
dipasang sebagai kolom terhitung langsung di `SELECT` utama
`useTransactions` — dipakai di `transaction-list-item.tsx` untuk
menampilkan ikon kecil (gambar/deskripsi) di tiap baris transaksi, dengan
tooltip penjelas saat hover. Menghindari N+1 query per baris karena
subquery-nya sudah ikut di query list yang sama, bukan query terpisah per
transaksi.

## Catatan

Kedua temuan awal dokumen ini sudah ditangani lewat script pencocokan
sekali jalan (bukan alur import formal): `ZDATA` — 199 dari 208 unit
terisi otomatis, sisa 9 unit menunggu isi manual (lihat "Status
implementasi (kolom `description`/ZDATA)"); foto — 20 dari 25 unit
foto unik (29 baris `PHOTO`, dedup pasangan transfer) terpasang, sisa 5
tidak punya file sumber sama sekali (lihat "Foto lama dari Money Manager").
Untuk keduanya, sisa yang tidak terisi otomatis butuh isi manual satu-satu
lewat form edit transaksi kalau mau dilengkapi — tidak ada rencana alur
otomatis lanjutan untuk sisa kasus ini karena jumlahnya kecil.

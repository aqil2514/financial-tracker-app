# Migrasi Primary Key: `INTEGER AUTOINCREMENT` → UUID

## Latar belakang

Ditemukan lewat diskusi soal Turso/multi-device sync (2026-09-29, lihat
`multi-device-sync.md`): semua tabel sekarang pakai
`id INTEGER PRIMARY KEY AUTOINCREMENT`. Ini aman selama cuma satu device
yang pernah menulis ke database. Begitu multi-device sync (Turso embedded
replica) aktif — 2+ device menulis OFFLINE bersamaan, walau sama-sama
milik satu user — auto-increment lokal di tiap device independen satu
sama lain dan BISA TABRAKAN saat sync (device A dan device B sama-sama
menghasilkan `id: 105` untuk baris berbeda).

Solusi standar: ganti primary key ke UUID yang di-generate SAAT baris
dibuat (di sisi klien, bukan diserahkan ke database).

**Kenapa dikerjakan SEKARANG, bukan ditunda sampai mau distribusi**:
migrasi ini makin mahal makin lama ditunda — setiap tabel baru yang
dibangun di atas asumsi `INTEGER AUTOINCREMENT` (mis. `account_type`
dan tabel detail per tipe akun yang direncanakan di `account-type.md`)
menambah scope migrasi nanti. Direkomendasikan diselesaikan SEBELUM
`account-type.md` mulai dikerjakan.

**Status dokumen ini (update 2026-09-30, akhir sesi eksekusi)**: SEMUA
keputusan desain sudah diambil (lihat "Yang belum diputuskan" di bawah,
semua poin tercoret). Eksekusi kode SUDAH JALAN sampai langkah 4 dari 8
di "Urutan kerja" — lihat detail lengkap di sana:
- Selesai & terverifikasi: crate `uuid` (+v7), modul import Money
  Manager (Rust), migrasi skema SQL (`0027_uuid_primary_keys.sql`,
  diuji ekstensif di scratchpad terhadap salinan `finance.dev.db`
  sungguhan — 0 data hilang, 0 orphan FK, 0 tabrakan UUID).
- BELUM dikerjakan: `src/lib/db.ts` (7 type definition TS), audit
  manual titik TS yang tidak tertangkap compiler, DAN — PALING PENTING
  — migrasi 27 belum pernah benar-benar dijalankan lewat `tauri dev`
  sungguhan (baru diuji di salinan scratchpad, bukan lewat mekanisme
  migrasi otomatis Tauri yang sesungguhnya). **BACA peringatan "sebelum
  restart tauri dev" di langkah 4/8 SEBELUM restart app manapun** —
  disarankan backup `finance.dev.db` dulu.

## Dampak — 3 lapis yang tersentuh

### Lapis 1: Skema database (`src-tauri/migrations/`)

Tabel AKTIF yang pakai `INTEGER PRIMARY KEY AUTOINCREMENT` (dicek
langsung dari migrasi terbaru per tabel, per 2026-09-30):

| Tabel | Migrasi definisi terakhir |
|---|---|
| `categories` | 0009 |
| `accounts` | 0009 |
| `account_groups` | 0005 |
| `transactions` | 0019 |
| `transaction_attachments` | 0022 |
| `contacts` | 0012 |
| `debts` | 0022 |
| `debt_payments` | 0022 |
| `retailku_sync_field_mapping` | 0020 (+0023, +0024) |

Tabel TIDAK termasuk (deprecated/dropped, jangan diikutkan):
- `retailku_account_mapping` — sudah tidak dipakai kode aktif (dikonfirmasi
  sesi 2026-09-29), cuma disebut di komentar historis.
- `retailku_ar_ap_snapshot` — sudah di-`DROP` di migrasi 0021.
- `settings` — perlu dicek dulu apakah key-value (tanpa PK auto-increment)
  atau bukan sebelum diikutkan.

Kolom FOREIGN KEY yang ikut berubah tipe (menunjuk ke salah satu tabel
di atas):

| Tabel | Kolom FK |
|---|---|
| `categories` | `parent_id` (self-referencing) |
| `accounts` | `group_id` |
| `transactions` | `category_id`, `account_id`, `transfer_account_id`, `contact_id` |
| `transaction_attachments` | `transaction_id` |
| `debts` | `contact_id`, `account_id`, `transaction_id` |
| `debt_payments` | `debt_id`, `account_id`, `transaction_id` |
| `retailku_sync_field_mapping` | `local_account_id`, `secondary_account_id`, `category_id` |

Total: **9 tabel**, **16 kolom FK** across 6 tabel penunjuk.

**Pola migrasi SQL**: pakai pola "copy-and-rename" yang sudah biasa
dipakai repo ini (lihat migrasi 0009, 0019, 0022 sebagai contoh nyata):
buat tabel baru dengan skema `TEXT PRIMARY KEY`, copy data dari tabel
lama sambil generate UUID baru per baris DAN remap semua FK ke UUID yang
sesuai, drop tabel lama, rename tabel baru. Bagian paling rawan bug:
proses remap FK harus konsisten — kalau `accounts.id: 5` jadi UUID
`"abc..."`, maka SEMUA baris `transactions.account_id = 5` juga harus
diubah ke `"abc..."` yang SAMA, bukan UUID baru yang berbeda.

Karena SQLite tidak punya fungsi generate-UUID bawaan, opsi:
- Generate UUID per baris di SQL migrasi lewat ekstensi/fungsi custom
  (perlu dicek apakah `rusqlite`/driver yang dipakai mendukung).
- ATAU generate mapping ID lama→UUID di sisi Rust (baca semua ID lama
  dulu, generate UUID di Rust pakai crate `uuid`, lalu jalankan UPDATE
  per tabel) — lebih terkontrol, kemungkinan lebih aman untuk migrasi
  sekompleks ini dibanding SQL murni.

**Urutan migrasi antar tabel PENTING** — tabel yang DIREFERENSIKAN
tabel lain harus dimigrasi (dan mapping ID lama→baru-nya disimpan
sementara) SEBELUM tabel yang mereferensikannya di-remap. Urutan aman:
1. `account_groups` (tidak referensi apa pun)
2. `categories` (self-referencing `parent_id`)
3. `contacts` (tidak referensi apa pun)
4. `accounts` (referensi `account_groups`)
5. `transactions` (referensi `categories`, `accounts`, `contacts`)
6. `transaction_attachments` (referensi `transactions`)
7. `debts` (referensi `contacts`, `accounts`, `transactions`)
8. `debt_payments` (referensi `debts`, `accounts`, `transactions`)
9. `retailku_sync_field_mapping` (referensi `accounts`, `categories`)

### Lapis 2: Rust (`src-tauri/src/`)

Dicek 2026-09-30: **hampir semua INSERT/UPDATE/SELECT dilakukan
langsung dari TypeScript** lewat `@tauri-apps/plugin-sql`, BUKAN lewat
Rust command per-entity (tidak ada `last_insert_rowid`/`LastInsertId`
ditemukan di `src-tauri/src/`). Artinya lapis Rust yang tersentuh migrasi
ini kemungkinan besar CUMA:
- File migrasi baru itu sendiri (`migrations/00XX_uuid_primary_keys.sql`
  atau setara, tergantung pendekatan SQL vs Rust-driven di atas).
- `migrations.rs` (daftar migrasi).
- **Modul import** (`src-tauri/src/import/money_manager/`) — SUDAH
  DIAUDIT (2026-09-30), lihat temuan detail di bawah ("Audit modul
  import Money Manager").

### Lapis 3: TypeScript (`src/`)

Sumber kebenaran tipe: **`src/lib/db.ts`** — 7 type definition
(`Category`, `AccountGroup`, `Account`, `Transaction`, `Contact`, `Debt`,
`DebtPayment`), semua field `id`/`*_id` bertipe `number`. Ini root dari
62 kemunculan `id: number` yang tersebar di 24 file lain (hook query,
context, util kecil) — sebagian besar KEMUNGKINAN cukup ikut berubah
otomatis begitu type di `db.ts` diubah ke `string` (TypeScript akan
tunjukkan compile error di semua titik yang perlu disesuaikan).

**Titik yang PERLU diaudit manual** (bukan cuma ganti tipe, tapi logic):
- Semua `INSERT INTO ... VALUES (...)` (24 file ditemukan lewat grep
  `INSERT INTO`) — sekarang `id` diserahkan ke SQLite (tidak disebut di
  kolom INSERT). Migrasi UUID berarti `id` harus DI-GENERATE DI JS
  SEBELUM insert dan disertakan eksplisit sebagai kolom. **UPDATE
  (2026-09-30): setelah keputusan UUID v7** (lihat "Yang belum
  diputuskan" poin 2), `crypto.randomUUID()` bawaan TIDAK BISA dipakai
  (cuma generate v4) — perlu dependency npm tambahan (mis. `uuidv7`)
  untuk semua titik ini — contoh titik: `use-create-account.ts`,
  `use-create-category.ts`, `use-create-contact.ts`,
  `use-create-account-group.ts`, `use-create-transaction.ts`,
  `use-create-debt.ts`, `use-pay-debt.ts`, `resolve-contact.ts`,
  `use-add-attachment.ts`, `insert-ar-ap-transaction.ts`,
  `insert-ar-ap-payment(s-batch).ts`, `insert-cashflow-transaction.ts`.
- Tempat yang mungkin diam-diam mengasumsikan `id` sbg proxy "lebih
  besar = lebih baru" (mis. `ORDER BY id DESC` sbg pengganti `ORDER BY
  created_at DESC`) — dengan UUID v7 (bukan v4) asumsi ini TETAP BENAR
  karena v7 punya timestamp di depan ID-nya, jadi risiko ini SUDAH
  DITUTUP oleh keputusan format UUID di atas, tidak perlu audit
  seketat semula (tapi tetap baik dicek sbg dokumentasi eksplisit,
  bukan implisit).
- Tempat yang pakai `id` sebagai React `key` — aman (string juga valid
  key), tidak perlu diubah.
- Tempat yang parse/format `id` sebagai number secara eksplisit (mis.
  `Number(id)`, template string matematis) — perlu dicari terpisah,
  belum ditemukan lewat grep awal.

## Audit modul import Money Manager (2026-09-30)

Dibaca langsung: `plan/groups.rs`, `plan/accounts.rs`, `plan/categories.rs`,
`plan/transactions.rs`, `plan/types.rs`, `command/writer.rs`.

**Temuan penting — lebih rawan dari dugaan awal, bukan cuma "perlu
diverifikasi"**: modul ini SUDAH generate ID sendiri secara eksplisit
untuk 3 dari 4 tabel yang di-import, BUKAN pasrah ke SQLite
auto-increment:

- `map_account_groups`, `map_accounts`, `map_categories` — semua assign
  `id = (i + 1) as i64` manual berbasis index array, lalu `INSERT INTO
  ... (id, ...) VALUES (?1, ...)` di `writer.rs` MENYERTAKAN `id` itu
  eksplisit di kolom INSERT. ID dipakai juga sebagai key resolve FK
  (`id_by_uid: HashMap<String, i64>`) sebelum ditulis.
- `map_income_expense`/`map_transfers` (transaksi) — TIDAK generate `id`
  sendiri (`PlannedTransaction` tidak punya field `id`), INSERT-nya
  TIDAK menyertakan kolom `id` — satu-satunya dari 4 tabel yang masih
  pasrah ke auto-increment SQLite.
- `clear_existing_data` juga eksplisit reset `sqlite_sequence` untuk
  4 tabel itu (`transactions`, `accounts`, `categories`,
  `account_groups`) — asumsi implisit bahwa proses import berjalan dari
  kondisi kosong dan ID mulai dari 1 lagi.

**Dampak untuk migrasi UUID**: 3 file (`plan/groups.rs`,
`plan/accounts.rs`, `plan/categories.rs`) HARUS diubah — assignment
`id = (i + 1) as i64` diganti generate UUID (mis. crate `uuid` versi 4,
sudah tersedia di ekosistem Rust standar), tipe `id_by_uid: HashMap<String,
i64>` di ketiganya (plus dipakai lintas modul: `transactions.rs` terima
`account_id_by_uid`/`category_id_by_uid` dari situ) berubah ke
`HashMap<String, String>`. Struct `PlannedAccountGroup`, `PlannedAccount`,
`PlannedCategory` (di `types.rs`) field `id`/`group_id`/`parent_id`
berubah `i64`→`String`. `PlannedTransaction.account_id`/`category_id`/
`transfer_account_id` (yang resolve dari `*_id_by_uid`) ikut berubah tipe,
walau `PlannedTransaction` sendiri tidak punya `id` (tetap pasrah ke
SQLite, TAPI SQLite sudah tidak auto-increment integer lagi setelah
migrasi skema — kolom `id` tabel `transactions` akan jadi `TEXT PRIMARY
KEY` tanpa default value, jadi baris INI JUGA perlu digenerate UUID-nya
di `writer.rs`, bukan lagi diserahkan kosong ke INSERT).
`clear_existing_data` — baris `DELETE FROM sqlite_sequence WHERE
name IN (...)` menjadi TIDAK RELEVAN lagi (sqlite_sequence cuma untuk
AUTOINCREMENT) begitu skema pindah ke `TEXT PRIMARY KEY`, harus dihapus
dari query itu.

Modul import ini jalur tulis MASSAL (7700+ transaksi per catatan
`import-category-dedup.md`) yang jalan dalam SATU transaksi SQL
(`rusqlite::Transaction`) — cocok jadi tempat pertama untuk uji pola
generate-UUID-lalu-INSERT sebelum dipakai di jalur lain (hook TS
`use-create-*`), karena sudah dalam satu file yang jelas & terisolasi.

## Audit database dev (2026-09-30)

Dilakukan mengikuti `docs/rules/checking-dev-database.md` — copy
`finance.dev.db` + `-wal` + `-shm` ke scratchpad (WAL kosong/0 byte saat
dicek, sudah ter-checkpoint, tidak ada transaksi tertunda yang
terlewat), query langsung ke salinan, BUKAN file aktif.

**Migrasi terbaru terkonfirmasi jalan**: versi 26 (`debt_payments_source_ref`),
semua `success = 1`.

**Volume baris per tabel** (dasar keputusan legacy_id di atas):

| Tabel | Baris |
|---|---|
| `account_groups` | 23 |
| `accounts` | 76 |
| `categories` | 116 |
| `contacts` | 8 |
| `transactions` | 5563 |
| `transaction_attachments` | 0 |
| `debts` | 7 |
| `debt_payments` | 3 |
| `retailku_sync_field_mapping` | 15 |
| **Total** | **~5811** |

95.7% baris ada di `transactions` sendiri — sisanya kecil. Skala ini
kecil untuk ukuran migrasi struktural (bandingkan: banyak migrasi UUID
di sistem produksi nyata menangani jutaan baris) — memungkinkan
verifikasi PENUH (bukan sampel) di tiap tahap tanpa memakan waktu
berarti.

**Integritas FK — NIHIL orphan ditemukan**: dicek `transactions.category_id`
dan `transactions.account_id` terhadap tabel induknya — 0 baris yang
menunjuk ID tidak ada. Data existing bersih, proses remap ID
lama→UUID TIDAK perlu menangani kasus "FK sudah rusak duluan".

**Kolom `created_at`**: ada di 8 dari 9 tabel — KECUALI `categories`,
yang tidak punya kolom itu sama sekali. Relevan kalau nanti mau audit
independen dari `legacy_id` (yang sudah diputuskan TIDAK dipakai) —
`categories` jadi satu-satunya tabel tanpa jejak waktu sama sekali di
luar ID itu sendiri.

**Distribusi FK di `transactions`** (utk menilai risiko remap):
`account_id` terisi di SEMUA baris (5563/5563, NOT NULL secara de
facto), `category_id` di 3328, `transfer_account_id` di 2251,
`contact_id` cuma di 14. `categories.parent_id` (self-referencing) di
76 dari 116 kategori — self-reference ini yang paling perlu hati-hati
saat remap (parent HARUS sudah dapat UUID baru sebelum anaknya
di-remap, konsisten dengan urutan dependency yang sudah disusun di atas).

## Yang BELUM diputuskan (jawab dulu sebelum mulai eksekusi)

1. ~~Generate UUID di mana (untuk data EXISTING saat migrasi jalan)~~ —
   DIPUTUSKAN & DIEKSEKUSI (2026-09-30): **SQL murni**, BUKAN Rust
   seperti dugaan awal di sini. Alasan: migrasi Tauri (`tauri-plugin-sql`)
   HANYA bisa jalankan SQL string via `include_str!`, tidak bisa
   menyisipkan logic Rust custom — jadi opsi "Rust-driven" tidak
   tersedia untuk migrasi lewat mekanisme yang sudah dipakai 26 migrasi
   sebelumnya. UUID v7 di-generate lewat ekspresi SQL manual
   (timestamp+randomblob, lihat detail lengkap di "Urutan kerja" langkah
   4 di bawah) — diuji 6000 generate berturut-turut, 0 tabrakan. File
   migrasi: `migrations/0027_uuid_primary_keys.sql`.
2. ~~Format UUID~~ — DIPUTUSKAN (2026-09-30): **UUID v7**, bukan v4.
   Alasan:
   - **Index SQLite tetap sehat** — v4 sepenuhnya acak, tiap INSERT jatuh
     di posisi acak dalam B-tree index primary key → fragmentasi,
     insert makin berat seiring tabel besar (`transactions` sudah
     7700+ baris, terus tumbuh). v7 punya timestamp di bagian depan
     ID-nya, jadi nilainya tetap "naik" seiring waktu mirip
     AUTOINCREMENT lama — pattern insert index tetap efisien.
   - **Menutup celah "asumsi id = urutan waktu"** yang disebut di Lapis
     3 di atas (`ORDER BY id DESC` dipakai sbg proxy `created_at DESC`)
     — dengan v7 asumsi itu TETAP BENAR walau tidak diaudit tuntas.
     Dengan v4 itu jadi bug tersembunyi.
   - Privasi timestamp (v7 membocorkan kapan baris dibuat dari ID-nya)
     BUKAN concern nyata di sini — ID tidak pernah diekspos ke pihak
     luar sebagai data sensitif (app offline-first, personal).

   **Dampak implementasi** (BARU, belum tercatat sebelumnya):
   - Rust: `Cargo.toml` perlu tambah feature `v7` (`uuid = { version =
     "1", features = ["v4", "v7"] }` — `v4` boleh tetap ada, masih
     dipakai `attachments/mod.rs`), panggil `Uuid::now_v7()` bukan
     `Uuid::new_v4()` di titik-titik yang bikin primary key tabel.
   - TypeScript: `crypto.randomUUID()` bawaan browser/Tauri webview
     **CUMA generate v4** — TIDAK bisa dipakai untuk v7. Perlu
     dependency tambahan (mis. package `uuidv7` dari npm, atau
     implementasi manual timestamp+random) untuk semua titik INSERT di
     hook TS (`use-create-account.ts`, dst — lihat daftar di Lapis 3).
     Ini mengubah asumsi awal dokumen ini ("tidak perlu library
     tambahan") — perlu diperbarui saat eksekusi nanti.
3. ~~Backward compat / rollback plan~~ — DIPUTUSKAN (2026-09-30):
   **TIDAK perlu `legacy_id`**, berdasarkan audit langsung ke
   `finance.dev.db` (lihat "Audit database dev" di bawah). Skala data
   kecil (~5.811 baris total) memungkinkan verifikasi PENUH (bukan
   sampel) di tiap tahap migrasi (scratchpad → dev → produksi, pola
   `checking-dev-database.md`) — jaring pengaman kolom permanen jadi
   marginal untuk skala ini, dan menambah utang "harus dihapus nanti"
   yang berisiko lupa.
4. ~~Modul import Money Manager~~ — SUDAH diaudit, lihat bagian di atas.
5. ~~Kapan dieksekusi~~ — DIPUTUSKAN (2026-09-30): **SEKARANG**, sebelum
   `account-type.md`. Dicek `account-type.md` sendiri: statusnya BELUM
   siap eksekusi sama sekali — bagian "Belum diputuskan" di sana masih
   3 poin besar (daftar tipe akun final, field spesifik tiap tipe,
   status `advance`/`third_party` sbg account_type atau bukan). Tidak
   ada urgensi "berbarengan" dengan sesuatu yang belum punya rencana
   matang untuk mulai. Mengerjakan UUID lebih dulu justru MEMBEBASKAN
   `account-type.md` dari beban migrasi ID — begitu `account_type` dan
   tabel detailnya (`credit_accounts`, `investment_accounts`, dst)
   mulai dibangun nanti, langsung didesain dengan `TEXT PRIMARY KEY`
   sejak awal. Semua prasyarat teknis lain (format UUID, pola generate-
   ID, crate Rust, legacy_id) sudah selesai diputuskan di atas — tidak
   ada lagi yang menghalangi mulai. **Catatan**: keputusan timing ini
   sudah final, TAPI eksekusi kode migrasi BELUM dimulai di sesi ini
   (user memilih "catat dulu, eksekusi nanti" saat ditanya) — sesi
   berikutnya bisa langsung lanjut ke "Urutan kerja" di bawah tanpa
   perlu tanya ulang soal timing.
6. ~~Crate `uuid` untuk Rust~~ — SUDAH ADA (dicek 2026-09-30):
   `uuid = { version = "1", features = ["v4"] }` di `Cargo.toml`, DAN
   sudah ada presenden pemakaian nyata di `attachments/mod.rs:40`
   (`Uuid::new_v4()`, dipakai utk nama file lampiran, bukan primary key
   tabel — tapi pola pemanggilannya bisa langsung dicontoh sama persis).
   Tidak perlu `cargo add` lagi, tinggal pakai.

## Urutan kerja yang disarankan (setelah poin di atas diputuskan)

1. ~~Audit modul import Money Manager~~ — SELESAI (2026-09-30), lihat
   bagian di atas.
2. ~~Tambah feature `v7` ke crate `uuid`~~ — SELESAI (2026-09-30):
   `Cargo.toml` sekarang `uuid = { version = "1", features = ["v4", "v7"] }`.
3. ~~Update modul import Money Manager ke UUID v7~~ — SELESAI
   (2026-09-30): `plan/types.rs` (`id`/`*_id` semua jadi `String`,
   `PlannedTransaction` sekarang juga punya field `id` — tadinya tidak
   punya, pasrah ke auto-increment, sekarang WAJIB generate eksplisit
   karena kolom `id` di skema akan jadi `TEXT PRIMARY KEY` tanpa
   default), `plan/groups.rs`/`plan/accounts.rs`/`plan/categories.rs`
   (`Uuid::now_v7().to_string()` ganti `(i + 1) as i64`, `id_by_uid`
   jadi `HashMap<String, String>`), `plan/transactions.rs` (signature
   `map_income_expense`/`map_transfers` ganti tipe HashMap ke `String`,
   `PlannedTransaction` di-construct dengan `id: Uuid::now_v7().to_string()`
   baru), `plan/mod.rs` (pemanggilan `adjustment_income_id`/
   `adjustment_expense_id` ganti jadi `&String` krn signature sekarang
   `&str`), `command/writer.rs` (INSERT `transactions` sekarang
   menyertakan kolom `id`, baris `DELETE FROM sqlite_sequence WHERE
   name IN (...)` DIHAPUS krn sudah tidak relevan tanpa
   AUTOINCREMENT). `cargo check` BERSIH.

   **PENTING — status SETENGAH JALAN, JANGAN coba import sungguhan
   sekarang**: kode modul import SUDAH generate UUID v7 string, TAPI
   skema tabel `accounts`/`categories`/`account_groups`/`transactions`
   di database MASIH `INTEGER PRIMARY KEY AUTOINCREMENT` (langkah 4 di
   bawah BELUM dikerjakan). `cargo check` bersih HANYA karena
   `rusqlite` tidak type-check terhadap skema real pada compile time —
   runtime kemungkinan besar akan ERROR/corrupt kalau import dijalankan
   sekarang (SQLite menolak/memperlakukan aneh string masuk ke kolom
   `INTEGER PRIMARY KEY AUTOINCREMENT`). Migrasi skema (langkah 4) HARUS
   selesai dulu sebelum modul import ini dites end-to-end.
4. ~~Tulis migrasi SQL per tabel EXISTING~~ — SELESAI (2026-09-30):
   `src-tauri/migrations/0027_uuid_primary_keys.sql`, terdaftar di
   `migrations.rs` sbg versi 27.

   **Keputusan implementasi PENTING (mengubah asumsi poin 1 di atas)**:
   migrasi Tauri (`tauri-plugin-sql`, mekanisme yang sudah dipakai 26
   migrasi sebelumnya) HANYA bisa jalankan SQL murni via
   `include_str!` — TIDAK bisa menyisipkan logic Rust custom. Jadi
   UUID di-generate LANGSUNG DI SQL (bukan di Rust seperti dugaan awal
   poin 1), lewat ekspresi manual: 48-bit pertama = timestamp ms epoch
   (`CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)`),
   grup ketiga diawali `7` (versi v7 fixed), grup keempat diawali salah
   satu dari `8`/`9`/`a`/`b` (variant bit RFC 4122), sisanya
   `randomblob()`. Diuji manual 6000 generate berturut-turut (skala ~
   tabel `transactions`) — SEMUA unik, 0 tabrakan.

   **Pola migrasi**: ikuti PERSIS pola "rename-semua-dulu → create-
   semua+insert-dengan-remap → drop-semua-di-akhir" dari 0009/0022
   (PENTING #2 di 0009 — drop tabel lama di tengah proses memicu ON
   DELETE SET NULL/CASCADE pada FK yang sudah aktif). Remap FK
   dilakukan lewat kolom `new_id` sementara (`ALTER TABLE ... ADD
   COLUMN new_id TEXT`) yang di-UPDATE dgn UUID per baris, lalu dipakai
   sbg sumber JOIN saat `INSERT INTO <tabel_baru> ... SELECT ... FROM
   <tabel_lama> LEFT JOIN <tabel_lain_lama> ON ...id = new_id`.
   `categories.parent_id` (self-referencing) di-JOIN ke `categories_old`
   itu sendiri. Urutan tabel di file SAMA PERSIS dgn daftar dependency
   di atas.

   **SEKALIAN** (diminta user bersamaan): `categories.created_at`
   ditambahkan di skema baru (backfill `datetime('now')` utk baris
   existing — tidak ada cara tahu waktu asli, tidak pernah direkam
   sebelumnya). Sekarang SEMUA 9 tabel scope migrasi ini punya
   `created_at`.

   **VERIFIKASI LENGKAP dilakukan di scratchpad** (copy `finance.dev.db`
   + `-wal` + `-shm`, ikut `checking-dev-database.md`), BUKAN cuma
   `cargo check`:
   - Jumlah baris SEBELUM vs SESUDAH migrasi — IDENTIK di semua 9
     tabel (total 5811 baris).
   - `PRAGMA foreign_key_check` — NIHIL pelanggaran.
   - `PRAGMA integrity_check` — `ok`.
   - Cross-check agregasi (`COUNT`+`SUM(amount)` per akun via JOIN
     `transactions`→`accounts`) SEBELUM vs SESUDAH — IDENTIK persis,
     membuktikan remap FK benar (bukan cuma "UUID valid", tapi
     "menunjuk ke baris yang SAMA secara logis").
   - Cross-check relasi parent-child `categories` (76 baris
     self-reference) SEBELUM vs SESUDAH — IDENTIK persis.
   - Validasi format seluruh ID yang ter-generate (36 karakter, versi
     `7` di posisi benar, variant bit valid) DAN `COUNT(DISTINCT id) =
     COUNT(*)` di semua 9 tabel — 0 tabrakan dari 5811 UUID.
   - Tidak ada tabel `_old` tersisa pasca migrasi (semua ter-drop
     bersih).

   File test SQL asli ada di scratchpad session ini (bukan bagian repo)
   kalau perlu ditelusuri ulang caranya.
5. Update `src/lib/db.ts` (7 type definition) — biarkan TypeScript
   compiler menunjukkan seluruh titik yang perlu ikut berubah. **BELUM
   dikerjakan.**
6. Audit manual titik-titik yang TIDAK tertangkap compiler (ORDER BY
   berbasis id, generate UUID sebelum INSERT di semua hook `use-create-*`
   — lihat daftar file di Lapis 3 di atas). **BELUM dikerjakan.**
7. Jalankan `tsc --noEmit` + `vitest run` + `cargo check` di tiap
   tahap (pola verifikasi yang sudah konsisten dipakai sesi-sesi
   sebelumnya). `cargo check` sudah dijalankan setelah langkah 3 & 4
   (bersih keduanya).
8. ~~Verifikasi manual via `tauri dev`~~ — SELESAI (2026-09-30):

   **Backup dulu**: `finance.dev.db`+`-wal`+`-shm` di-backup ke
   `AppData/Roaming/com.windows.financial-app/` dgn suffix
   `bak_20260930_041148_pre-uuid-migration` SEBELUM restart pertama —
   jalan mundur tetap tersedia kalau nanti ternyata perlu (walau hasil
   di bawah tidak menunjukkan indikasi perlu dipakai).

   User restart `tauri dev` sungguhan → migrasi 27 otomatis jalan.
   Diverifikasi via query langsung ke salinan scratchpad (copy
   `.db`+`-wal`+`-shm` — WAL 3.2MB, hasil migrasi memang belum
   di-checkpoint ke `.db` utama, PERSIS peringatan di
   `checking-dev-database.md`):
   - `_sqlx_migrations`: versi 27 `success = 1`.
   - Jumlah baris IDENTIK di semua 9 tabel (5811 total) — 0 data hilang.
   - `PRAGMA integrity_check` → `ok`, `PRAGMA foreign_key_check` → nihil.
   - Cross-check agregasi `COUNT`+`SUM(amount)` per akun (BRI, ABF
     Indonesia Bond Index Fund, dst) — IDENTIK persis dgn data SEBELUM
     migrasi (dibandingkan ke `check.db` dari audit sebelumnya).
   - `categories.created_at` — ADA, terisi, format benar.
   - Semua ID: 36 karakter, 0 tabrakan (`COUNT(DISTINCT id) = COUNT(*)`
     di semua 9 tabel).
   - Tidak ada tabel `_old`/kolom `new_id` tersisa.

   **KESIMPULAN: migrasi 27 BERHASIL TOTAL di `finance.dev.db` live.**
   Tidak ada indikasi kerusakan data apa pun.

   **PENTING — apa yang MASIH BELUM aman dipakai**: skema database
   sudah UUID, TAPI `src/lib/db.ts` dan SELURUH lapis TypeScript (62
   kemunculan `id: number` di 24 file, lihat Lapis 3 di atas) MASIH
   mengasumsikan `id` sbg `number`. UI aplikasi KEMUNGKINAN BESAR AKAN
   ERROR/berperilaku aneh sekarang kalau dicoba dipakai (query yang
   compare/format `id` sbg number akan mismatch dgn data yang sekarang
   string) — langkah 5 & 6 di bawah WAJIB selesai dulu sebelum UI
   dianggap aman dipakai lagi. Modul import Money Manager (langkah 3)
   juga masih belum pernah dites end-to-end nyata (coba import file
   Money Manager sungguhan) — secara skema sekarang SUDAH cocok, tapi
   belum ada satu kali pun percobaan sejak migrasi 27 ditulis.

## Status akhir (2026-09-30) — SEMUA 8 langkah SELESAI

Migrasi UUID v7 TUNTAS di sesi ini, bukan cuma skema — SELURUH lapis
TypeScript ikut disesuaikan sampai bersih di 3 gerbang verifikasi.

5. ~~Update `src/lib/db.ts`~~ — SELESAI: 7 type definition (`Category`,
   `AccountGroup`, `Account`, `Transaction`, `Contact`, `Debt`,
   `DebtPayment`) semua field `id`/`*_id` jadi `string`.
6. ~~Audit manual titik yang tidak tertangkap compiler~~ — SELESAI,
   TAPI ternyata jauh lebih besar dari perkiraan awal (72 error `tsc`
   di 28 file untuk sekadar update tipe, lalu ~15 file lagi untuk
   generate-ID-sebelum-INSERT yang BARU KETAHUAN saat proses — total
   >30 file source + 10 file test tersentuh). Temuan PENTING yang tidak
   tercakup di analisis awal dokumen ini:
   - **Semua `INSERT INTO` yang sebelumnya pasrah ke SQLite
     auto-increment SEKARANG WAJIB generate `id` eksplisit** — dibuat
     helper terpusat `src/lib/id.ts` (`newId()`, pakai package npm
     `uuidv7` yang di-install sesi ini, zero-dependency) dipakai di
     SEMUA titik: `use-create-account.ts`, `use-create-category.ts`,
     `use-create-contact.ts`, `use-create-account-group.ts`,
     `use-create-transaction.ts`, `use-correct-account-balance.ts`,
     `resolve-contact.ts`, `apply-debt-transaction.ts` (3 titik:
     receivable/payable/settlement), `use-create-debt.ts`,
     `use-pay-debt.ts`, `use-add-attachment.ts`,
     `use-field-mapping.ts` (UPSERT), DAN 4 titik di modul sync
     Retailku yang HAMPIR TERLEWAT (`insert-cashflow-transaction.ts`,
     `insert-ar-ap-transaction.ts`, `insert-ar-ap-payment.ts`,
     `insert-ar-ap-payments-batch.ts`) — ditemukan lewat audit manual
     `grep "INSERT INTO"` ke SELURUH `src/`, BUKAN dari error compiler
     (rusqlite/sqlx tidak type-check terhadap skema real, jadi bug ini
     TIDAK terlihat dari `tsc`/`cargo check` sama sekali kalau tidak
     dicari manual).
   - Semua `Number(id)`/`Number(xxx_id)` yang sebelumnya mengonversi
     form value (string dari `<select>`) balik ke number sebelum
     dikirim ke query — DIHAPUS di seluruh titik (form transaksi, form
     debt, 3 form mapping Retailku) karena sekarang ID tetap string
     sepanjang alur.
   - `settleDebtIds.map(Number)` di `apply-debt-transaction.ts` —
     BUG NYATA yang ditemukan (bukan cuma type mismatch): akan
     menghasilkan `NaN` untuk semua UUID kalau tidak diperbaiki.
   - `a.id - b.id` (aritmetika pengurangan ID untuk sort) di
     `debts-summary/content/utils.ts` — diganti `a.id.localeCompare(b.id)`,
     aman berkat keputusan UUID v7 (tetap terurut waktu).
   - `crypto.randomUUID()` bawaan TIDAK dipakai (cuma generate v4) —
     dependency `uuidv7` baru ditambah khusus untuk ini, sesuai
     keputusan format UUID di atas.
7. ~~`tsc --noEmit` + `vitest run` + `cargo check`~~ — SEMUA BERSIH:
   `tsc --noEmit` 0 error, `vitest run` 153/153 lulus (termasuk
   `apply-debt-transaction.test.ts` yang ditulis ulang total — fake DB
   in-memory disesuaikan ke pola INSERT baru, ID `fake-N` diganti
   `expect.any(String)` karena fungsi asli sekarang generate UUID
   sendiri lewat `newId()`, bukan diserahkan ke fake DB), `cargo check`
   bersih.
8. ~~Verifikasi manual via `tauri dev`~~ — SELESAI (2026-09-30): user
   restart `tauri dev` (rebuild Rust ~31s, window terbuka normal ke
   `/dashboard`), buat 1 transaksi baru sungguhan dari UI (expense,
   note "test"). Diverifikasi via query langsung ke salinan scratchpad
   (`.db`+`-wal`+`-shm`, WAL 3.28MB — sesuai dugaan, transaksi baru
   belum di-checkpoint):
   - Baris baru ketemu (`created_at` paling baru): `id` UUID v7 valid
     (36 karakter, versi `7`, variant bit `9`).
   - JOIN `account_id`→`accounts` DAN `category_id`→`categories`
     BERHASIL (bukan orphan) — resolve ke nama akun/kategori asli
     ("Bahana Likuid Syariah Kelas G" / "Akademi"), membuktikan
     `newId()` di `use-create-transaction.ts` DAN penghapusan
     `Number(values.account_id)`/`Number(values.category_id)` bekerja
     benar di jalur nyata, bukan cuma lolos type-check.
   - `PRAGMA integrity_check` → `ok`, `PRAGMA foreign_key_check` →
     nihil pelanggaran, di SELURUH database (bukan cuma baris baru).

   **User memilih TIDAK lanjut coba akun/kategori/kontak/debt** —
   dianggap cukup representatif (transaksi adalah jalur PALING
   kompleks: menyentuh account_id + category_id + berpotensi trigger
   `applyDebtTransaction`), sisanya akan "ketahuan selama dogfooding"
   pemakaian sehari-hari, bukan diverifikasi eksplisit sesi ini. Modul
   import Money Manager (langkah 3) MASIH belum pernah dites end-to-end
   nyata (coba import file Money Manager sungguhan) — tidak tersentuh
   sesi ini sama sekali.

**MIGRASI UUID v7 SELESAI TOTAL** — skema, Rust, TypeScript, dan
verifikasi live semuanya tuntas. Satu-satunya gap tersisa: modul import
Money Manager belum dites end-to-end sejak migrasi 27 (lihat langkah 3
di atas) — kalau user pernah import ulang data Money Manager, ini yang
paling layak dicoba duluan.

## Catatan

Terpisah dari migrasi UUID: strategi conflict resolution untuk
multi-device sync (last-write-wins vs deteksi+tanya user vs
append-only) TETAP belum diputuskan — dicatat di `multi-device-sync.md`,
bukan scope dokumen ini. UUID menyelesaikan masalah TABRAKAN ID,
BUKAN masalah "baris sama diedit di 2 device sebelum sync" — dua
masalah berbeda yang sering tertukar dalam diskusi.

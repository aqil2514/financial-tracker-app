# Handover — 2026-10-25 (sesi 2)

Sesi ini murni kerja di `apps/mobile`, dimulai dari halaman Transaksi yang sebelumnya kosong total (cuma `PageHeader`). Progresnya besar: filter/sort generik, SQLite lokal + migrasi, form generik, sampai alur tambah transaksi end-to-end yang sudah **terverifikasi jalan** di device fisik (screenshot user, bukan cuma lint/typecheck). Semua dikerjakan bertahap dengan banyak `AskUserQuestion` sebelum tiap keputusan arsitektur — user eksplisit minta tidak sekali jalan.

Diawali dari assessment: [docs/todos/plan/porting-transaction.md](../../todos/plan/porting-transaction.md) berisi perbandingan fitur desktop vs mobile untuk halaman transaksi (113 file/~5.167 baris di desktop) — baca itu untuk konteks fitur apa saja yang BELUM diporting (debt/investment/label/attachment/kalender/rich-text, dst).

## Filter & Sort generik (`components/query/`)

Port dari `apps/desktop/src/components/query/{filters,sort}/` — scope disepakati "sama persis desktop" di level data model (`FilterConfig`, `SortConfig`, 4 tipe field: text/select/number/combobox, builder SQL `buildWhereClause`/`buildOrderClause`), tapi UI-nya didesain ulang total karena primitif desktop (Radix `<Select>`/`<Combobox>`/Popover) tidak ada ekuivalen di RN.

### Keputusan UI mobile
- Trigger Filter/Sort = bottom sheet full-screen (`@gorhom/bottom-sheet`, `BottomSheetModal`, `snapPoints={["100%"]}`), bukan popover kecil seperti desktop.
- Primitif baru `components/query/shared/option-picker.tsx` (`OptionPicker`) — nested `BottomSheetModal` untuk "pilih dari daftar", menggantikan `<Select>`/`<Combobox>` Radix. Mendukung mode `multiple` (draft lokal + tombol "Selesai", untuk filter select/combobox) dan `searchable` (field cari di atas list, untuk combobox opsi banyak).
- State filter/sort = **in-memory saja** (reset kalau app di-kill), bukan persist ke disk — keputusan eksplisit user, didesain sebagai hook generik supaya persist-ke-disk bisa ditambah belakangan sebagai opsional per-pemakai kalau dibutuhkan.

### Bug besar yang ditemukan & di-fix: Portal memutus React Context
`BottomSheetModal` di-hoist lewat `@gorhom/portal` ke `BottomSheetModalProvider` di root `_layout.tsx` — secara tree React SEBENARNYA, children modal BUKAN keturunan dari context Provider manapun yang didefinisikan di posisi JSX-nya, meski terlihat nested. `FilterPanelContent`/`FilterPanelFooter` yang awalnya baca `useFilterPanel()` sendiri → crash runtime "Cannot read property 'length' of undefined" (konfirmasi via riset ke GitHub issue gorhom #2576, react-native-portal#3 — tidak ada fix resmi dari maintainer).

**Fix**: `FilterPanelContent`/`FilterPanelFooter` diubah jadi *controlled component* murni (terima semua lewat props), context dibaca SEKALI di `FilterPanelInner` (masih di tree asli, di luar portal) lalu diteruskan manual. `OptionPicker`/`SortDropdown` aman dari awal karena tidak pernah pakai React Context (murni props + state lokal) — pola ini WAJIB diikuti untuk komponen generik baru yang dirender di dalam `BottomSheetModal` manapun di app ini.

### Setup wajib terkait
- `_layout.tsx` root: `GestureHandlerRootView` membungkus `BottomSheetModalProvider` (wajib untuk gorhom v5).
- Warning console `[Reanimated] Dependencies should only be used on the web...` dan `ImageBackground is deprecated` — dikonfirmasi riset: keduanya dari KODE INTERNAL `@gorhom/bottom-sheet` (28 call site hook dengan dependency array usang + komponen internal yang masih pakai API RN deprecated), murni cosmetic, tidak ada fix di versi gorhom saat ini (5.2.14). User pilih DIBIARKAN, bukan disuppress.

Struktur akhir: `components/query/{filters,sort}/` + `components/query/shared/option-picker.tsx`, dipasang di `features/transactions/header/{filter,sort}.tsx` → `TransactionHeader` (1 baris: judul kiri, Sort+Filter+Tambah sejajar kanan, via prop baru `PageHeader actions`).

## SQLite lokal (`lib/database/`)

`expo-sqlite` dipasang (plugin polos di `app.json`, TANPA `enableFTS`/`useSQLCipher` — disepakati simetris dengan desktop dulu, bisa ditambah nanti kalau dibutuhkan proteksi data finansial).

### Struktur migrasi (sudah di-refactor dari versi awal)
Versi PERTAMA sempat satu-file (`migrate.ts`) dengan `DATABASE_VERSION` manual + blok `if (currentDbVersion === N)` bertumpuk — user sadar risikonya ("gampang kepencet ikut ubah migrasi lama") dan minta pindah ke pola file terpisah SAAT migrasi pertama SUDAH ter-apply di device:

```
lib/database/
├── migrations/
│   ├── 0001_initial.ts       — CREATE TABLE transactions (SUDAH ter-apply, JANGAN diedit)
│   ├── 0002_pragma_defaults.ts — foreign_keys=ON + busy_timeout=5000, DIBUAT TAPI SENGAJA
│   │                              BELUM didaftarkan di index.ts (draft, ditahan user)
│   └── index.ts               — array MIGRATIONS[], urutan = urutan eksekusi
├── migrate.ts                  — runner generik (loop dari currentVersion, PRAGMA user_version),
│                                  TIDAK PERLU diedit lagi saat nambah migrasi baru
├── generate-id.ts              — generateId() = uuidv7() (lihat bagian UUID di bawah)
├── provider.tsx                 — AppDatabaseProvider (bungkus SQLiteProvider + onInit)
└── index.ts                     — barrel: AppDatabaseProvider, DATABASE_NAME, generateId, useDatabase
```

**Cara nambah migrasi baru**: file `migrations/000N_nama.ts` baru (isi cuma `up(db)`), daftarkan di `migrations/index.ts`. `migrate.ts` generik, tidak disentuh. Migrasi yang sudah ter-apply TIDAK BOLEH diedit (prinsip sama dengan [feedback_migration_never_edit_applied] di memory, untuk desktop) — selalu file baru.

Skema `transactions` saat ini (versi 1): `id TEXT PRIMARY KEY`, `note`, `description`, `type` (CHECK income/expense/transfer), `amount REAL`, `date`, `category_id`/`account_id`/`transfer_account_id` (TEXT bebas, BUKAN FK ke tabel lain — tabel `accounts`/`categories` belum dibuat), `has_attachment INTEGER`, `created_at`. `PRAGMA journal_mode = 'wal'` sudah di-set di migrasi 0001.

### UUID v7 (bukan v4) — konsisten dengan desktop
Desktop pakai UUID v7 untuk primary key (lihat `apps/desktop/src-tauri/migrations/0027_uuid_primary_keys.sql`) — alasan: 48-bit pertama = timestamp, index SQLite tetap "naik" seiring waktu, penting untuk multi-device sync yang direncanakan (lihat [project_worker_dev_prod_isolation] di memory). `expo-crypto`'s `randomUUID()` CUMA v4, jadi dipakai `uuid` npm package (`v7 as uuidv7`).

**Setup wajib yang mudah terlewat**: `uuid` butuh `crypto.getRandomValues()` yang TIDAK disediakan Hermes secara native (maintainer Hermes sengaja menolak, lihat facebook/hermes#915) — perlu polyfill `react-native-get-random-values`, di-import PALING ATAS `_layout.tsx` SEBELUM import apa pun lain (urutan kritis, dibaca saat module load bukan lazy). Sudah terpasang dan di-import dengan benar.

Dependency baru yang ditambahkan user sendiri sesi ini (semua lewat `npx expo install`, dikonfirmasi tidak mentah-mentah `npm i`): `@gorhom/bottom-sheet@^5.2.14`, `expo-sqlite@~58.0.14`, `react-hook-form@^7.91.0`, `zod@^4.6.7`, `@hookform/resolvers@^5.9.1` (SENGAJA dipin seri 5.x, BUKAN 6.0.0 terbaru — v6 mensyaratkan `effect@^4.0.0` yang konflik ERESOLVE dengan paket lain di npm workspace monorepo ini; 5.9.1 sama persis versi yang dipakai `apps/desktop`), `uuid@^14.0.3`, `react-native-get-random-values`.

## Form generik (`components/forms/`)

Port dari `apps/desktop/src/components/forms/` — user secara spesifik minta mulai dari `BaseForm` (bukan `EntityForm`/`useEntityForm` yang terikat `useDbMutation`/React Query, infrastruktur yang belum ada di mobile).

`base-form.tsx`: kontrak sama persis desktop (`schema`, `defaultValues`, `onSubmit`, `isPending`, `children` sebagai render-prop yang terima `form`). Beda dari desktop: `<form>`/`DialogFooter` (web-only) jadi `View` biasa, submit dipicu manual via `onPress` yang panggil `form.handleSubmit(onSubmit)` (RN tidak punya event submit native).

`form-fields/` — baru 3 dari 10 field desktop (disepakati mulai dari yang paling dasar/sering dipakai dulu, sisanya textarea/date/date-range/combobox/combobox-multi/currency/rich-text/toggle-group/icon-picker/color-picker BELUM diporting):
- `form-field-text.tsx` — `secureTextEntry` menggantikan prop `type` HTML (tidak ada ekuivalen RN).
- `form-field-number.tsx` — `onChange` kirim string mentah (Zod yang coerce), BUKAN `Number()` manual di komponen (ingat [project_uuid_migration_leftover_number_coercion] soal bahaya coercion manual).
- `form-field-select.tsx` — reuse `OptionPicker` dari `components/query/shared/`, bukan bikin UI baru.

Pola `<Controller>` + `{ field, fieldState }` + pesan error identik desktop — field baru nanti tinggal ikut pola yang sama.

## CRUD transaksi — create SUDAH jalan, TERVERIFIKASI di device

`features/transactions/form/` (schema.ts, values.ts, transaction-form.tsx) — subset schema desktop, HANYA field yang sesuai skema tabel mobile saat ini (tanpa contact_name/settle_debt_ids/unit/price_per_unit/investment_status/label_names/source_ref — butuh tabel debts/investment_*/labels yang belum ada). `description` jadi `string` biasa (bukan `JSONContent` Tiptap).

`TransactionForm` satu komponen dipakai bareng create & edit (pola `form/add-edit/` desktop) — `category_id`/`transfer_account_id` toggle berdasarkan `form.watch("type") === "transfer"`, field lain teks bebas karena belum ada tabel `accounts`/`categories` untuk combobox asli.

Route: `app/transactions/new.tsx` (di LUAR `(tabs)`, push via `router.push`) — `INSERT INTO transactions`, `router.back()`. Trigger: tombol "+ Tambah" di `TransactionHeader`. Judul halaman di-set eksplisit via `<Stack.Screen options={{ title: "Tambah Transaksi" }} />` (default-nya nama route mentah `"transactions/new"`, sempat jadi temuan dari screenshot user).

List: `features/transactions/content/` — `dummy-data.ts` DIHAPUS total, diganti `use-transactions.ts` (`useTransactions()` hook) yang query `SELECT * FROM transactions ORDER BY date DESC, created_at DESC` dan refetch via `useFocusEffect` (dari `expo-router`) tiap halaman mendapat fokus — jadi transaksi baru langsung muncul begitu kembali dari form, TANPA React Query/cache layer apa pun. Empty state ditambahkan ("Belum ada transaksi.").

**Terverifikasi oleh user via 2 screenshot**: form terisi → submit → transaksi muncul di list, dikelompokkan per tanggal, badge tipe/kategori benar, warna nominal benar. Satu transaksi test menampilkan "+Rp0" — dikonfirmasi BUKAN bug (user sengaja tidak isi field Jumlah, default `amount: 0` dipertahankan sebagai perilaku yang diinginkan, BUKAN diperbaiki jadi placeholder kosong wajib isi).

## Belum dikerjakan / gap terbuka untuk sesi berikutnya

1. **Filter & Sort belum tersambung ke query nyata** — UI sudah jalan (buka sheet, pilih, terapkan, state tersimpan), tapi `TransactionList`/`useTransactions()` belum menerima `filters`/`sorts` dan belum memanggil `buildWhereClause`/`buildOrderClause` yang sudah di-port. Builder generate placeholder `$1`/`$2` (gaya Tauri plugin), sedangkan `expo-sqlite` pakai `?` posisional — perlu penyesuaian sebelum bisa dipakai langsung ke `runAsync`/`getAllAsync`.
2. **Halaman edit transaksi belum dibuat** — fondasinya sudah siap (`TransactionForm` didesain untuk dipakai bareng), tinggal buat `app/transactions/[id]/edit.tsx` (baca `useLocalSearchParams`, `SELECT ... WHERE id = ?` buat `defaultValues`, `UPDATE` saat submit).
3. **Delete transaksi belum ada** sama sekali di mobile.
4. **`account_id`/`category_id`/`transfer_account_id` masih teks bebas** (`FormFieldText`), bukan `FormFieldSelect` ke data asli — perlu tabel `accounts`/`categories` dulu (migrasi baru, belum didesain skemanya).
5. **Migrasi `0002_pragma_defaults.ts` sudah ditulis tapi SENGAJA belum didaftarkan** di `migrations/index.ts` (lihat bagian SQLite di atas) — user minta ditahan sebagai pengingat, bukan dieksekusi otomatis. Cek dengan user kapan siap diaktifkan.
6. Field type sisa di `components/forms/form-fields/` (7 dari 10) belum diporting — textarea, date, date-range, combobox (single-search), combobox-multi, currency (format Rupiah + kalkulator numpad), rich-text, toggle-group, icon-picker, color-picker. Beberapa di antaranya (rich-text/Tiptap) butuh keputusan pengganti karena web-only, sudah dicatat sebagai gap terbuka di `docs/todos/plan/porting-transaction.md`.
7. Fitur besar yang sama sekali belum disentuh: kalender ringkasan harian, attachment upload, label, integrasi debt/investment/third-party-fund, Retailku import, pagination/infinite-scroll untuk list — semua tercatat detail di `docs/todos/plan/porting-transaction.md`.

## Memory yang ditulis/diupdate sesi ini
- `project_mobile_sqlite_migration_pattern` — pola migrasi file-terpisah (sempat ditulis ulang sekali setelah refactor dari versi single-file).

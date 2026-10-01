# Handover — 2026-09-23

## 1. Fix root cause duplikasi sync Retailku (lanjutan handover 2026-09-22)

- `isSourceRefSynced` (exact-match `source_ref`) diganti `isPeriodSynced`
  di `retailku/sync-cashflow/sync/sync-cashflow.ts` — sekarang mode-agnostic
  lewat `LIKE` prefix `"tanggal:accountId"`, jadi ganti mode sync (ringkas
  vs detail) untuk periode yang sama tidak lagi menghasilkan insert dobel.
- **PENTING — pelajaran soal migrasi**: migrasi `0017_transaction_source.sql`
  sempat diedit (cuma komentar) padahal SUDAH pernah diterapkan ke
  database — ini SALAH, sqlx menyimpan checksum seluruh isi file migrasi,
  jadi edit apa pun (termasuk komentar) di migrasi yang sudah applied
  memicu error `migration N was previously applied but has been modified`
  saat app di-start ulang. Sudah diperbaiki (file 0017 dikembalikan persis
  ke isi aslinya), tapi **JANGAN PERNAH edit file migrasi yang sudah
  applied** — kalau perlu menambah dokumentasi/penjelasan soal migrasi
  lama, taruh di migrasi BARU atau di komentar kode yang memakainya,
  jangan sentuh file lama sama sekali.

## 2. Refactoring struktur `features/transactions/` (lanjutan besar dari 2026-09-22)

Merapikan seluruh `content/calendar/`, `content/list/`, dan `form/` supaya
konsisten dengan `docs/rules/page-layout.md` — rekursi section/dialog jadi
folder (`header/`, `content/`, `context/`, dll) begitu bagiannya mulai
punya beberapa sub-file, konsisten dengan struktur yang sudah dipakai di
level fitur.

### `content/calendar/`
- `header/index.tsx`, `content/index.tsx` (+ `calendar-summary-header.tsx`,
  `calendar-day-button.tsx` ikut pindah ke dalam `content/`), `context/index.tsx`
  (dari `calendar-context.tsx` flat) — semua sudah direkursi jadi folder,
  sejajar dengan pola `list/`.
- Fix bug: `index.tsx` sempat mengimpor `./calendar-card-header` yang
  sudah tidak ada (broken import, ketahuan dari `tsc`).

### `content/list/`
- `header/` (+ `filter.tsx`, `sort.tsx`), `content/` (+ `item/` — direkursi
  lagi jadi `item/index.tsx` orkestrator + `item/info.tsx` + `item/actions.tsx`),
  `footer/` (+ `pagination.tsx`), `context/` — semua sudah jadi folder.
- `context/index.tsx` di-refactor jadi 4 hook di `context/hooks/`:
  `use-list-data.ts`, `use-list-filter.ts`, `use-list-page-control.ts`,
  `use-list-lookup.ts` — masing-masing return salah satu dari 4
  named interface (`ListContextData`/`Filter`/`PageControl`/`Lookup`
  di `context/interface.ts`), digabung di `ListProvider`. Consumer akses
  lewat `useList().data`/`.filter`/`.pageControl`/`.lookup`.
- `use-transactions.ts` dipecah jadi folder `use-transactions/` — satu
  function satu file (`build-where-conditions.ts`, `extract-attachment-condition.ts`,
  `run-transactions-queries.ts`, `to-transactions-page-result.ts`,
  `interface.ts` untuk `TransactionListRow`/`HAS_ATTACHMENT_SUBQUERY`).
  `index.ts` sekarang murni orkestrator 5 langkah bernomor komentar.

### `form/` — TUNTAS migrasi lama vs baru
- **Item lama dari handover 2026-09-22 SELESAI**: `form/transaction-edit-dialog.tsx`
  dan `form/use-update-transaction.ts` (versi lama, dipakai `DeepLinkEditDialog`)
  DIHAPUS. `DeepLinkEditDialog` (`page/deep-link-edit-dialog.tsx`) sekarang
  memanggil `useTransactionsDialog().openDialog("edit", id)` — membuka
  dialog context-driven versi BARU (`dialog/transaction-edit-dialog.tsx`)
  lewat context yang sama, bukan merender komponen dialog terpisah dengan
  prop `transaction`. Efek balik (dialog ditutup dari dalam → `?edit` di
  URL ikut dibersihkan) tetap dipertahankan lewat `useEffect` kedua yang
  mengawasi `dialog?.type`.
- `transaction-form.tsx` (327 baris, logic+view campur) dipecah:
  - Logic → `form/add-edit/hooks/use-transaction-form.ts` (orkestrator:
    watch field, derive state, compose 2 hook di bawah, `handleSubmit`/
    `handleSubmitAndContinue`).
  - `use-transaction-debt-fields.ts` — semua state/validasi utang-piutang
    (`debtStatus`, `debtFieldsLocked`, `needsDebtAction`, `validateDebtFields`).
  - `use-account-category-options.tsx` — opsi dropdown akun/kategori +
    `renderAccountOption` (JSX, makanya `.tsx` bukan `.ts`).
  - `transaction-form.tsx` sekarang view murni — panggil `useTransactionForm`,
    destructure, render JSX saja.
- `ContactField` (`form/add-edit/fields/contact-field.tsx`): pesan
  "Piutang ini sudah menerima cicilan..." yang tadinya paragraf terpisah
  di `transaction-form.tsx` dipindah HARDCODE ke dalam `ContactField`
  sendiri (tampil otomatis saat `disabled`) — BUKAN lewat prop, sesuai
  permintaan eksplisit user. Dicek aman: satu-satunya pemakai lain
  (`features/debts/new-debt-form/`) tidak pernah kirim `disabled`.

### Duplikasi yang dituntaskan (semua dari catatan 2026-09-22)
- `typeConfig` → `shared/constants.ts`.
- `accountName`/`categoryName` → `shared/utils/account-name.ts` +
  `shared/utils/category-name.ts` — dipakai `content/list/context/hooks/use-list-lookup.ts`
  DAN `dialog/transaction-detail-dialog.tsx`. **Sekaligus diperbaiki**:
  `accountName` sekarang menyertakan `group_name` (pola "Nama — Grup")
  karena dikonfirmasi lewat query `finance.db` PRODUKSI (bukan cuma
  dugaan) ada banyak akun dengan nama sama persis tapi grup beda (BRI,
  Digital, Kas Lele, Shopee Pay Later). Catatan: akun BRI (id 7,29,31)
  dan Shopee Pay Later (id 32,46) grup-nya JUGA sama persis — masih
  ambigu walau sudah ada nama grup, solusinya rename/merge manual oleh
  user, BUKAN kode (sudah dikonfirmasi user, tidak perlu dikerjakan lagi).
- `useTransactionById`, `useTransactionDays`, `useMonthSummary`,
  `useDeleteTransaction` → semua di `shared/hooks/`. `useTransactions`
  (content/list) SENGAJA tidak ikut pindah — cuma dipakai 1 section.

### Belum tuntas
- `hooks/use-entity-form.ts` (versi lama di root `hooks/`) masih dipakai
  12+ fitur lain (accounts, contacts, categories, dst) — belum
  dimigrasikan ke versi baru (`components/forms/hooks/use-entity-form.ts`).
  Scope besar, lintas-fitur, sengaja belum disentuh sesi ini.

## 3. `transactions.note` sekarang NOT NULL

- Migrasi `0019_transaction_note_not_null.sql` (table-rebuild pola sama
  seperti `0009`) — backfill baris lama `note IS NULL` jadi
  `'Tanpa catatan'`, lalu `note TEXT NOT NULL`. Didaftarkan di
  `src-tauri/src/migrations.rs` (version 19) — **WAJIB restart app**
  supaya migrasi ini ter-apply (tidak hot-reload).
- Tipe `Transaction.note` di `lib/db.ts` jadi `string` (bukan
  `string | null`).
- Layout `content/list/content/item/info.tsx` disusun ulang (referensi:
  Money Manager) — urutan baru per item transaksi:
  `note (font medium, judul)` → `kategori badge + ikon lampiran/deskripsi`
  → `nama akun` → `tanggal`. Sebelumnya nama akun ada di baris paling atas.

## 4. Halaman detail akun baru (fondasi, BELUM ada isi transaksi)

Latar: karena `next.config.ts` pakai `output: "export"` (Tauri, static
export — TIDAK ada server setelah build), dynamic route `[id]` TIDAK
VIABLE untuk data yang beda-beda per instalasi user (database SQLite
lokal per device, `generateStaticParams()` di build time developer tidak
pernah tahu id yang akan ada di device user). Pola query-param
(`?id=<id>`) dipakai, sama seperti `?edit=<id>` yang sudah ada.

- Route: `app/(app)/accounts/detail/page.tsx` → `/accounts/detail?id=<id>`,
  baca `id` lewat `useSearchParams()` dibungkus `Suspense` (pola sama
  seperti `DeepLinkEditDialog`).
- Fitur baru **berdiri sendiri**: `features/account-detail/` (BUKAN
  sub-folder `features/accounts/`, karena ini konteks halaman independen).
  Struktur ikut `page-layout.md`: `page/account-detail-page-context.tsx`
  (`AccountDetailPageProvider`/`useAccountDetailPage` — resolve
  `accountId` ke `AccountWithBalance` lewat `useAccounts()` yang sudah
  di-cache, BUKAN query baru per-akun), `header/` (nama, saldo, badge
  grup/nonaktif, tombol kembali), `content/` (PLACEHOLDER teks saja untuk
  sekarang).
- Klik card akun di `features/accounts/sections/list/content/item.tsx`
  sekarang navigasi ke `/accounts/detail?id=<id>` (card jadi
  `role="button"` + keyboard-accessible). Menu aksi titik-tiga (Lihat
  Detail/Koreksi/Edit/Hapus) TETAP jalan seperti biasa —
  `stopPropagation` di wrapper-nya supaya klik menu tidak ikut trigger
  navigasi card.
- **Relasi dengan `AccountDetailDialog` (modal) yang SUDAH ADA**:
  TIDAK diganti/dipensiunkan. Modal "Lihat Detail" (titik-tiga) tetap
  untuk aksi cepat/ringkasan. Halaman baru ini untuk "lebih dalam" —
  scope belum dibahas detail user, BELUM ada rancangan konten
  (transaksi apa yang ditampilkan, filter/pagination seperti apa, CRUD
  apa yang scoped ke akun ini) — cuma fondasi routing yang sudah jalan.

### Lanjut sesi berikutnya
- Isi `AccountDetailContent` — rancang dulu (bahas dengan user) sebelum
  kode: transaksi apa yang ditampilkan (semua transaksi akun ini dengan
  filter/pagination mirip `content/list/` transaksi?), CRUD scoped akun
  ini, beda konkretnya dengan modal `AccountDetailDialog` yang sudah ada.
- Migrasi `hooks/use-entity-form.ts` lama → versi baru (12+ fitur,
  scope besar, lintas-fitur).

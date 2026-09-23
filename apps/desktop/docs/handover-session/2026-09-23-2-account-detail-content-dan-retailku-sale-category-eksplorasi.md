# Handover — 2026-09-23 (sesi 2)

Lanjutan dari `2026-09-23-1-transaction-form-refactor-account-detail-page.md`
(fondasi halaman `/accounts/detail?id=<id>` sudah ada, isi kontennya
masih placeholder). Sesi ini mengisi konten itu penuh, lalu pindah topik
ke eksplorasi Retailku sync.

## 1. Halaman detail akun (`features/account-detail/`) — TUNTAS

### Isi konten: list transaksi scoped ke akun
- Reuse penuh infrastruktur `features/transactions/content/list/`
  (`ListProvider`/`ListCardContent`/`ListCardFooter`/`TransactionListItem`)
  lewat parameter baru `accountId?: number` yang ditambahkan ke
  `useTransactions`/`buildWhereConditions`/`ListProvider` — bukan
  membangun ulang. Kondisi scope: `(account_id = $N OR
  transfer_account_id = $N)`, jadi transfer masuk/keluar akun ini ikut
  ke-scope, bukan cuma transaksi income/expense langsung.
- `TransactionListFilter`/`TransactionListSort`/`ListProvider`/`useList`/
  `ListCardContent`/`ListCardFooter` diekspor publik dari
  `features/transactions/index.ts` (sebelumnya cuma internal ke fitur
  itu) supaya bisa direuse `account-detail`.
- Tombol "Tambah Transaksi" membuka dialog create yang SAMA dengan
  halaman Transaksi (`TransactionCreateDialog`/`useCreateTransaction`
  dapat prop baru `defaultAccountId?`) — `account_id` form otomatis
  terisi akun yang sedang dilihat, tetap bisa diganti manual.

### Audit struktur vs `docs/rules/page-layout.md` — 3 temuan, semua diperbaiki
1. `page.tsx` sempat berisi logic (`useSearchParams`, parsing
   `accountId`, JSX fallback inline) — dipindah ke komponen fitur baru
   `page/account-detail-body.tsx` (pola sama persis dengan
   `DeepLinkEditDialog` di `features/transactions/page/`).
2. `TransactionsPageProvider`/`TransactionsDialogProvider` sempat
   dipasang di `content/index.tsx` — dipindah naik ke `app/.../page.tsx`
   (pola sama seperti `app/(app)/transactions/page.tsx`).
3. `TransactionsDialogs` sempat dirender di dalam `content/index.tsx`
   — dipindah ke komponen baru `page/account-detail-dialogs.tsx`,
   disejajarkan dengan content di level page, bukan di dalamnya.

Struktur `page/` account-detail final: `account-detail-page-context.tsx`
(provider `accountId`→`AccountWithBalance`), `account-detail-body.tsx`
(deep-link query param), `account-detail-dialogs.tsx` (reuse dialog
transaksi + `defaultAccountId`), `account-detail-transaction-list-provider.tsx`
(bungkus `ListProvider` dengan `accountId`, dipasang di level page supaya
`header/` dan `content/` sama-sama konsumsi `useList()` yang sama).

### Header: ringkasan + filter/sort + PeriodPicker
- `AccountSummaryStats` (baru, `header/account-summary-stats.tsx` +
  `use-account-summary.ts`): grid 4 kolom Masuk/Keluar/Total/Saldo Saat
  Ini, query SUM langsung dari DB (bukan derive dari list dipaginasi).
  Query key didaftarkan di `QUERY_DEPENDENCIES.transactions` supaya ikut
  invalidate saat transaksi berubah.
- Filter+sort (`TransactionListFilter excludeKeys={["account_id"]}` +
  `TransactionListSort`) ditambahkan sebelum stats — opsi filter "Akun"
  disembunyikan via prop baru `excludeKeys?: string[]` di
  `TransactionListFilter` karena scope sudah otomatis ke 1 akun.
- **`PeriodPicker` baru** (`components/query/period-picker/`) —
  diadaptasi dari `retail-multitenant`'s `_shared/molecules/period-picker.tsx`
  (preset Hari/Minggu/Bulan/Kuartal/Tahun + navigasi geser + kalender
  kustom tunggal/rentang). JSX disusun ulang untuk primitif
  `@base-ui/react` yang dipakai financial-app (beda dari Radix di
  source aslinya — mis. `PopoverContent` di sini tidak punya
  `collisionPadding`). **Disiapkan untuk halaman Laporan** (belum
  digarap), tapi SEKALIGUS disambungkan nyata ke filter transaksi
  account-detail (bukan cuma preview) — `dateRange`/`setDateRange` baru
  di `ListContextFilter`, diterjemahkan jadi `date(date) BETWEEN $N AND
  $N+1` di `build-where-conditions.ts` (JALUR TERPISAH dari sistem
  `FilterConfig[]`/`buildWhereClause` generik, karena kolom `date`
  datetime butuh pembungkus `date(...)` yang tidak otomatis ada di
  builder generik itu).

### Saldo berjalan (running balance) per transaksi
- `TransactionListRow` dapat field opsional `running_balance?: number`.
- `run-transactions-queries.ts` bercabang: kalau `accountId` diberikan,
  query dibungkus CTE dengan window function `SUM() OVER (ORDER BY date
  ASC, id ASC)` (rumus tanda sama persis dengan
  `features/accounts/dialogs/detail-dialog/right-side/running-balance-query.ts`
  yang sudah ada & teruji production — SENGAJA diduplikasi, bukan
  di-share, karena kolom SELECT beda). `accountId` sebagai numbered
  placeholder `$N` ditaruh di urutan PALING AKHIR (`params.length + 1`)
  — dikonfirmasi aman dipakai berulang dalam satu query (SQLite `$N`
  resolve by angka, bukan posisi tekstual; dibuktikan lewat pola yang
  sama di kode production yang sudah ada).
- **3 test baru** (`run-transactions-queries.test.ts`) — verifikasi
  string-matching untuk numbering placeholder (bukan eksekusi SQLite
  asli, proyek tidak punya dependency itu untuk testing).
- UI: "Saldo Rp..." ditampilkan di bawah nominal transaksi
  (`content/list/content/item/actions.tsx`), cuma muncul kalau
  `running_balance` ada. **Disepakati user**: kalau sort bukan tanggal,
  angka tetap benar tapi urutannya jadi tidak kronologis — dibiarkan
  apa adanya, tidak perlu ditangani.

### Bug UI kecil — diperbaiki
Baris "Akun" di modal Detail Transaksi (`transaction-detail-dialog.tsx`)
dan modal serupa di detail akun (`accounts/dialogs/detail-dialog/right-side/detail-tab.tsx`)
overlap teks kalau value 2 baris (transfer, nama akun panjang) — `flex
items-center justify-between` diganti `items-start` + `shrink-0` pada
label + `text-right` pada value.

## 2. Bug ditemukan & diperbaiki di luar scope awal: race condition Retailku auto-sync

Saat testing account-detail, muncul error live `UNIQUE constraint
failed: transactions.source, transactions.source_ref` dari toast
"Sinkronisasi Retailku otomatis gagal". **Root cause (dikonfirmasi lewat
trace kode, BUKAN dugaan)**: `syncAll()` dipanggil dari 2 sumber
independen (`useRetailkuAutoSync` otomatis saat app dibuka, dan
`useSyncRetailkuAll` tombol "Sync Sekarang" manual) tanpa koordinasi —
kalau kebetulan jalan bersamaan, keduanya baca state "belum tersinkron"
di titik yang sama lalu sama-sama insert `source_ref` yang identik.

**Fix**: lock in-memory module-level di `sync-all.ts` — panggilan
`syncAll()` yang datang saat sync lain masih berjalan di-antre (bukan
ditolak), jadi semua sync (manual/otomatis) otomatis serial, tidak
pernah konkuren lagi. **4 test baru** (`sync-all.test.ts`, pola
mock-modul karena `syncAll` murni orkestrasi) memverifikasi: urutan
normal, rollback all-or-nothing tetap jalan, DUA panggilan konkuren
terbukti tidak overlap (`maxConcurrent` selalu 1, dibuktikan pakai
deferred promise), dan lock tetap terlepas kalau panggilan pertama
gagal (tidak macet selamanya).

Total test suite sekarang: **101 test, 14 file**, semua lolos. Build +
typecheck bersih sepanjang sesi.

## 3. Eksplorasi Retailku sync — kategori penjualan (SALE)

User bertanya: cashflow dari penjualan bisa dideteksi? Lalu digali lebih
dalam: apakah PPOB dan Consignment murni pendapatan, atau ada campuran
transfer/utang-piutang?

**Dikonfirmasi lewat data nyata (2 transaksi + jurnal lengkap, MCP
"Warung Aqil")** — jawabannya TIDAK murni untuk keduanya, dengan pola
BERBEDA:

- **PPOB** (`SL-260921-08`): satu `sourceType: SALE` menghasilkan DUA
  baris cashflow di DUA akun berbeda — Kas Tunai +27.000 (pendapatan
  asli) DAN Seabank -21.780 (bayar ke provider PPOB, PENGELUARAN).
  Keduanya berlabel `sourceType: SALE` yang sama persis. Mapping naif
  `SALE → kategori Penjualan` akan salah mengkategorikan baris
  pengeluaran sebagai pendapatan.
- **Consignment** (`SL-260922-15`): satu baris cashflow di kas
  MENCAMPUR pendapatan asli (Rp4.000) + komisi (Rp500) + titipan uang
  penitip (Rp1.500, liability) — TIDAK BISA dipisah dari data cashflow
  sama sekali, karena akun "Hutang ke Penitip" bukan akun kas/bank
  sehingga tidak pernah muncul sebagai baris cashflow terpisah.

Temuan lengkap + 4 pertanyaan terbuka (heuristik pembeda akun provider
PPOB, opsi pisahkan consignment lewat sync terpisah, skala prioritas
— PPOB+Consignment cuma 11% kontribusi omzet bulan ini, desain skema
mapping) dicatat di **`docs/todos/plan/retailku-sale-category-mapping.md`**
(status: EKSPLORASI, belum ada rencana implementasi).

## Lanjut sesi berikutnya

**User eksplisit**: lanjut kerjakan mapping kategori dari sync
(`retailku-sale-category-mapping.md`) — mulai dari `SALE` dulu. Sebelum
mulai ngoding, ke-4 pertanyaan terbuka di dokumen itu perlu dibahas dan
diputuskan lebih dulu:
1. Heuristik robust untuk bedakan baris "pendapatan asli" vs "bayar
   provider" pada transaksi PPOB (baru 1 sample dicek — perlu sampling
   lebih luas untuk tahu pola konsisten atau tidak).
2. Consignment: diselesaikan dari cashflow (tidak mungkin penuh) atau
   dibiarkan + selesaikan lewat sync terpisah (`get_consignment_settlement_list`,
   pola serupa sync AR/AP yang sudah ada)?
3. Prioritas: worth dikerjakan sekarang atau `category_id` tetap kosong
   untuk hasil sync (assign manual)?
4. Desain skema mapping `sourceType`→`category_id` kalau jadi
   dikerjakan (tabel baru mirip `retailku_account_mapping`? UI di mana?).

Juga belum disentuh sesi ini (dari handover sebelumnya, masih terbuka):
migrasi `hooks/use-entity-form.ts` lama → versi baru (12+ fitur
lintas-fitur, scope besar, sengaja belum disentuh).

# Periode Kategori (Category Period) — Desktop

> Detail implementasi sisi desktop utk fitur lintas-app "Periode
> Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Skema DB + form create + list (filter & sort) + edit/delete SELESAI
(2026-10-11) — lihat "Rencana pendekatan" di bawah utk detail teknis
& revisi desain yang terjadi di tengah jalan (many-to-many kategori).
Sisanya (wiring push ke `apps/worker`) BELUM BISA dikerjakan — lihat
item terakhir checklist, butuh tabel D1 + endpoint Worker dulu yang
belum dibuat sama sekali.

**Ringkasan transaksi (total masuk/keluar/selisih) TIDAK masuk scope
tab Periode** — diputuskan (2026-10-11) tab ini murni manajemen
periode (CRUD metadata: nama, tanggal, kategori terkait), ringkasan
akan ada di halaman Report terpisah yang memanfaatkan periode ini.

- [x] Migrasi `category_periods` + registrasi di `migrations.rs` —
  `0047_category_periods.sql` (versi 47).
- [x] **REVISI** (2026-10-11, lihat "Revisi: many-to-many kategori"
  di bawah): migrasi `0048_category_periods_many_categories.sql`
  (versi 48) — `category_periods` di-rebuild TANPA `category_id`
  (copy-and-rename), tabel pivot baru `category_period_categories`
  (many-to-many ke `categories`, lintas tipe income/expense
  sekaligus). 10 test Rust lulus total.
- [x] Kolom cloud-sync (`updated_at`/`deleted_at`/`sync_source`) di
  KEDUA tabel dari migrasi pertama — BEDA dari investasi yang
  nambah belakangan (migrasi `0042`), krn sync ke `apps/worker`
  sudah diputuskan perlu sejak awal.
- [x] Refactor halaman `/master-data/categories` jadi `BaseTabs`:
  tab "Daftar Kategori" (`content/list/`, isi existing dipindah ke
  situ) + tab "Periode" (`content/period/`, section baru).
- [x] Form create periode (`CategoryContentPeriodForm`) — nama,
  multi-select kategori (`FormFieldComboboxMulti`, baru dibuat),
  rentang tanggal (`FormFieldDateRange`, baru dibuat, bungkus
  `PeriodPicker`, plus teks bantu bahwa tanggal akhir boleh
  perkiraan). Dialog (`CreateCategoryPeriodDialog`) trigger+dialog
  menyatu dalam satu komponen, state dari context lokal
  (`CategoryPeriodDialogProvider`, `provider/dialog-state/`).
  Diverifikasi jalan di app (`tauri dev`), termasuk 1 bug runtime
  ditemukan+diperbaiki (lihat catatan di bawah).
- [x] Hook `useCategoryPeriods`(query, JOIN ke pivot) +
  `useCreateCategoryPeriod` (mutation, insert periode lalu loop
  insert pivot). Query key domain sendiri (`categoryPeriods`) di
  `QUERY_DEPENDENCIES`.
- [x] List periode (`CategoryPeriodList`, `list/`) — grid card per
  periode (nama, rentang tanggal, kategori terkait), badge status
  "Berlangsung" (amber)/"Selesai" (emerald) dari kolom computed
  `is_ongoing` (`date('now') BETWEEN start_date AND end_date`, TANPA
  migrasi — `end_date` tetap `NOT NULL`, dimaknai perkiraan selama
  periode masih berlangsung).
- [x] Filter (`CategoryPeriodFilter`, `list/period-filter.tsx`) —
  pakai sistem generik `components/query/filters/`: nama periode
  (text), kategori terkait (combobox, opsi HANYA kategori yg
  benar-benar sudah dipakai di suatu periode — `usePeriodCategoryOptions`,
  bukan semua kategori master data), status berlangsung/selesai
  (select, computed). `category_id` & `status` diterjemahkan manual
  ke `extraConditions` (EXISTS subquery / `date('now') BETWEEN`) krn
  bukan kolom asli `category_periods` — TIDAK lewat `buildWhereClause`
  biasa. 2 bug ditemukan+diperbaiki saat verifikasi runtime: (1)
  `name` ambigu dgn `categories.name` stlh JOIN — fix pakai kolom
  qualified `category_periods.name` di `FILTERABLE_COLUMNS` DAN
  `filterKey`; (2) filter combobox/select SELALU `string[]` (bukan
  string tunggal, salah asumsi awal) — kondisi `typeof === "string"`
  sebelumnya bikin filter kategori & status diam-diam tidak pernah
  aktif.
- [x] Sort (`CategoryPeriodSort`, `list/period-sort.tsx`) — pakai
  sistem generik `components/query/sort/`: nama, tanggal mulai,
  tanggal selesai (kolom qualified `category_periods.*`). Default
  urutan saat TIDAK ada sort aktif tetap `is_ongoing DESC,
  start_date DESC` (periode berlangsung duluan).
- [x] Edit & delete periode — pola dialog SAMA dgn create (satu
  instance di-render per jenis dialog di level section, bukan per
  card; context `CategoryPeriodDialogType` ditambah `"edit"`/
  `"delete"`, `PeriodCard` cuma panggil `openDialog(type, period.id)`).
  - **Edit** (`dialogs/edit.tsx`, `EditPeriodDialog`) — **reuse
    `CategoryContentPeriodForm` APA ADANYA** (form yg sama persis dgn
    create, tanpa percabangan mode create/edit di dalamnya). Butuh 2
    query tambahan sblm render form: `usePeriodById` (data periode by
    id) + `usePeriodCategoryIds` (array `category_id` milik periode
    itu, krn list query cuma punya `category_names` string gabungan,
    bukan array id) — pola sama `TransactionEditDialog` (tunggu kedua
    query siap, `return null` dulu, baru render komponen anak yg
    manggil hook mutation, supaya tidak ada percabangan Rules of
    Hooks). `getCategoryPeriodEditValues` (`form/schema/values.ts`)
    convert `CategoryPeriod` + `category_ids[]` jadi
    `CategoryPeriodFormValues` (string tanggal → `Date`).
    `useUpdateCategoryPeriod`: UPDATE `category_periods`, lalu DELETE
    semua baris pivot lama + INSERT ulang sesuai pilihan baru (bukan
    diff) — simpel, tidak ada tracking historis pivot yg perlu
    dipertahankan.
  - **Delete** (`dialogs/delete.tsx`, `DeletePeriodDialog`) — pakai
    `ConfirmDeleteDialog` generic yg sudah ada (`components/`), bukan
    bikin ulang. `useDeleteCategoryPeriod` cuma `DELETE FROM
    category_periods` — baris pivot ikut terhapus otomatis via `ON
    DELETE CASCADE` (migrasi `0048`), tidak perlu DELETE manual ke
    `category_period_categories`.
  - Kedua hook MURNI SQLite lokal (tanpa `pushOnWrite`/
    `pushDeleteOnWrite`), konsisten dgn create — lihat item wiring
    push di bawah knp belum bisa.
- [ ] **Wiring push ke `apps/worker`** (`pushOnWrite`/
  `pushDeleteOnWrite`) utk `category_periods` DAN
  `category_period_categories` di titik mutasi (create/update/delete)
  — **BELUM BISA dikerjakan saat ini**, BUKAN cuma belum sempat:
  `apps/worker` SAMA SEKALI belum punya tabel D1
  `category_periods`/`category_period_categories` ataupun endpoint utk
  menerimanya — `pushOnWrite`/`pushDeleteOnWrite` akan GAGAL
  TYPE-CHECK kalau dipanggil sekarang krn kedua tabel ini belum
  terdaftar di `QueueableTable`/`DeletableTable`
  (`shared/cloud-sync/push-queue/types.ts`). Prasyarat sblm hook
  desktop bisa disentuh: (1) tabel D1 di `apps/worker` (skema sama
  persis dgn SQLite), (2) endpoint Worker utk terima write periode,
  (3) daftarkan ke `QueueableTable`/`DeletableTable`. Detail lintas-app
  lihat bagian "Cloud sync & MCP" di bawah.

## Latar belakang

Kebutuhan: user ingin bisa menjawab pertanyaan semacam "panen tahun
kemarin keluar-masuknya berapa?" atau "kemarin beli skin game
Aspirant abis berapa?" — yaitu ringkasan transaksi dalam rentang
tanggal custom yang punya nama/makna sendiri (bukan filter bulan/
tahun kalender biasa).

Keputusan eksplisit dari diskusi awal (2026-10-11):
- **Periode tersimpan sebagai entitas** (bukan filter sesaat/
  transient) — supaya punya nama ("Panen 2025") dan bisa dilihat
  ulang nanti, beda dari filter transaksi/`period-picker` yang sudah
  ada sekarang (`apps/desktop/src/components/query/period-picker/index.tsx`)
  yang sifatnya query-state murni, tidak disimpan.
- Skema AWAL (migrasi `0047`): scope per SATU kategori (`category_id`
  tunggal) — **KEMUDIAN DIREVISI**, lihat "Revisi: many-to-many
  kategori" di bawah. Jangan pakai bentuk skema ini sbg referensi,
  sudah basi.

**BEDA dari konsep "Budget" yang sudah dicatat sebelumnya**
(`budget-feature.md`, belum diimplementasi) — gampang tertukar krn
sama-sama "kategori + rentang waktu":
- **Budget** = target/limit nominal per kategori per bulan,
  forward-looking, dibandingkan ke aktual ("jangan sampai lewat
  segini").
- **Periode** (dokumen ini) = jendela waktu custom bernama,
  backward-looking, buat ringkasan histori yang SUDAH terjadi
  ("kemarin itu totalnya berapa").

Kedua konsep ini independen, tidak saling menggantikan. Nama tabel
`category_periods` dipilih sengaja beda dari kemungkinan nama tabel
Budget nanti (`budgets`/`budget_amounts`) biar tidak rancu.

## Revisi: many-to-many kategori (2026-10-11)

Ditemukan dari kasus nyata saat review UI: kategori di app ini
dipisah per TIPE transaksi (`categories.type`, income/expense
terpisah) — siklus nyata spt "panen" (biaya pupuk/bibit = expense,
hasil jual = income) TIDAK BISA direpresentasikan sbg satu
`category_id` tunggal seperti desain awal `0047`. User harus bikin
2 Periode terpisah lalu jumlah manual, menggagalkan tujuan fitur ini.

**Keputusan**: many-to-many lewat tabel pivot
(`category_period_categories`), BUKAN tetap 1 kategori + digabung
manual di UI by name. Migrasi `0048` me-rebuild `category_periods`
TANPA `category_id` (pola copy-and-rename —
`docs/rules/sqlite-copy-and-rename-migration.md`, pola sederhana
krn dikonfirmasi via grep tidak ada tabel lain yg `REFERENCES
category_periods`), sekaligus tambah tabel pivot baru. Backfill data
lama SENGAJA dilewati — diverifikasi langsung ke `finance.dev.db`
sebelum menulis migrasi, tabel `category_periods` masih 0 baris di
semua device (fitur baru dibuat hari yang sama, migrasi `0047` belum
pernah dipakai bikin data sungguhan).

Konsekuensi ke kode TS yang sudah terlanjur ditulis utk skema lama
(SEMUA diupdate mengikuti revisi ini di hari yang sama):
`categoryPeriodSchema.category_id` (string) jadi `category_ids`
(array, min 1), combobox kategori di form jadi multi-select (field
generic baru `FormFieldComboboxMulti`, lihat di bawah), hook query
`useCategoryPeriods` jadi JOIN ke tabel pivot, hook mutation
`useCreateCategoryPeriod` insert periode dulu lalu loop insert baris
pivot per kategori terpilih.

## Rencana pendekatan

### Skema (SETELAH revisi `0048`)

```sql
CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE TABLE category_period_categories (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (period_id, category_id)
);
```

Masih TANPA tabel ledger/history transaksi terpisah. Ringkasan
transaksi (total masuk/keluar/selisih) TIDAK dibangun di sini —
diputuskan (2026-10-11) jadi scope halaman Report terpisah, bukan
tab Periode. Kalau nanti dibangun di Report, query acuannya:
`transactions WHERE category_id IN (SELECT category_id FROM
category_period_categories WHERE period_id = ?) AND date BETWEEN
start_date AND end_date` (on-the-fly, sama prinsip dengan
`accounts.balance` yang derived) — dicatat di sini sbg referensi,
BUKAN rencana implementasi tab ini.

Belum ada keputusan soal validasi `end_date >= start_date` di level
DB (CHECK) vs cuma di level UI/form (saat ini validasi ADA tapi
cuma di schema Zod via `dateRangeSchema`, lihat
`components/forms/form-fields/form-field-date-range.tsx`) — belum
diputuskan perlu CHECK constraint DB juga atau cukup di form.

### UI (progress nyata)

Kategori sebelumnya tidak punya halaman/dialog detail sama sekali.
Alih-alih bikin halaman detail terpisah per kategori (`?id=`), arah
yang dipilih (2026-10-11): **tetap satu halaman** `/master-data/categories`,
direfactor pakai `BaseTabs` (`components/pattern/base-tabs.tsx`) —
tab "Daftar Kategori" dan tab "Periode" di dalamnya, BUKAN detail
view per kategori.

Struktur folder yang terbentuk:
```
features/categories/
├── content/
│   ├── index.tsx              — BaseTabs (2 tab)
│   ├── list/                  — tab "Daftar Kategori"
│   │   ├── index.tsx          — CategoryListSection (Card wrapper)
│   │   ├── list/               — isi dipindah dari features/categories/list/ lama
│   │   └── form/                — isi dipindah dari features/categories/form/ lama
│   └── period/                — tab "Periode"
│       ├── index.tsx          — CategoryPeriodSection (render 1 instance
│       │                         per jenis dialog: create/edit/delete)
│       ├── dialogs/
│       │   ├── context.tsx    — CategoryPeriodDialogType: "create"|"edit"|"delete"
│       │   ├── create.tsx     — CreateCategoryPeriodDialog (trigger+dialog menyatu)
│       │   ├── edit.tsx       — EditPeriodDialog (reuse CategoryContentPeriodForm)
│       │   └── delete.tsx     — DeletePeriodDialog (ConfirmDeleteDialog generic)
│       ├── form/
│       │   ├── index.tsx      — CategoryContentPeriodForm (dipakai create & edit)
│       │   └── schema/        — categoryPeriodSchema, defaultValues, editValues
│       ├── list/
│       │   ├── index.tsx      — CategoryPeriodList (state filters/sorts)
│       │   ├── period-card.tsx     — PeriodCard (badge status, tombol edit/delete)
│       │   ├── period-filter.tsx   — CategoryPeriodFilter
│       │   └── period-sort.tsx     — CategoryPeriodSort
│       └── hooks/
│           ├── use-category-periods.ts
│           ├── use-create-category-period.ts
│           ├── use-update-category-period.ts
│           ├── use-delete-category-period.ts
│           ├── use-period-by-id.ts
│           ├── use-period-category-ids.ts
│           └── use-period-category-options.ts
└── index.ts                   — barrel (export dari content/list/{list,form})
```

Isi tab Periode saat ini: CRUD periode lengkap (create/edit/delete)
+ list dengan filter & sort (lihat checklist atas untuk detail
teknis). Satu-satunya yg belum bisa adalah sync ke Worker/MCP.

**Keputusan desain dialog** (2026-10-11, sempat bolak-balik):
trigger (tombol "Tambah Periode") dan `<Dialog>` sungguhan SENGAJA
digabung jadi satu komponen (`CreateCategoryPeriodDialog`) — BEDA
dari pola `dialog-pattern.md` yang biasanya motong trigger/dialog
jadi file terpisah. Alasan: dialog Periode akan py lebih dari satu
jenis (create, nanti edit/delete-confirm) jadi TETAP butuh context
`createDialogContext` (`CategoryPeriodDialogProvider`,
`useCategoryPeriodDialog`, type union `"create"` siap ditambah
varian baru) utk "dialog mana yang aktif" sbg satu sumber kebenaran
— tapi secara VISUAL/STRUKTUR FILE, trigger tetap menyatu di
komponen dialog-nya sendiri (`DialogTrigger` shadcn native di dalam
`create.tsx`), bukan dipecah ke file `create-trigger.tsx` terpisah.

**Field form baru yang dibuat** (generic, masuk
`components/forms/form-fields/`, lihat README modul itu utk detail
lengkap):
- `FormFieldDateRange` — bungkus `PeriodPicker` sbg field form
  (value `DateRange | undefined`), juga mengekspor `dateRangeSchema`
  (Zod, validasi from/to wajib + to >= from) supaya schema lain yg
  pakai field ini tidak menulis ulang validasi yang sama.
- `FormFieldComboboxMulti` — combobox multi-select generic (chip-
  based, pakai dukungan native `Combobox` `multiple` dari base-ui).
  **Bug ditemukan+diperbaiki saat verifikasi runtime** (2026-10-11):
  percobaan awal merender `ComboboxChip` di luar `ComboboxChips`
  (supaya area chip bisa dipisah visual dari kotak pencarian) GAGAL
  runtime (`Cannot destructure property 'setHighlightedChipIndex'`)
  — `ComboboxChip` primitif base-ui WAJIB berada dalam
  `ComboboxChips` (butuh React context dari situ). Fix: `ComboboxChips`
  tetap dipakai sbg provider context, tapi di-style transparan
  (`border-none bg-transparent`) dan dipisah ke baris sendiri di atas
  kotak pencarian (`ComboboxInput` biasa, bukan `ComboboxChipsInput`)
  — jadi visual "chip terpisah dari search box" tetap tercapai tanpa
  melanggar struktur yang dibutuhkan primitifnya. Area chip juga
  dibungkus `<div className="max-h-32 overflow-y-auto">` (BUKAN
  komponen `ScrollArea` project — viewport `ScrollArea` pakai
  `size-full` yang sempat bikin konten overlap ke field lain di
  bawahnya saat chip banyak) supaya tidak meluber saat kategori
  terpilih banyak.

Label combobox kategori: `"[Pemasukan|Pengeluaran] <Induk> • <Nama>"`
(mis. `"[Pengeluaran] Investasi • Cryptocurrency"`) — menyertakan
kategori induk (bukan menyembunyikannya) supaya kategori dgn nama
sama di induk berbeda tetap bisa dibedakan, DAN menyertakan arah
income/expense krn itu sering relevan buat tahu kategori mana yang
dipilih (lihat "Revisi: many-to-many kategori" di atas, kasus panen
butuh milih kategori lintas tipe sekaligus).

### Cloud sync & MCP — diputuskan PERLU dari awal, BELUM dikerjakan

Beda dari investasi (yang desktop-only duluan, sync menyusul), utk
Periode Kategori sync ke `apps/worker` + tool `apps/mcp-server`
**sudah diputuskan perlu dari awal** (2026-10-11) — supaya
pertanyaan seperti "panen tahun kemarin berapa?" bisa dijawab
asisten AI, bukan cuma dibuka manual di desktop. Konsekuensi konkret
(ikut pola `investment-sync.md` Tahap 0 — replikasi logic penuh,
BUKAN sekadar tabel mirror):

- Desktop tetap jadi sumber migrasi SQLite pertama & pemilik
  logic/UI, tapi `apps/worker` butuh tabel D1 sendiri
  (`category_periods` + `category_period_categories`, skema sama)
  supaya device/klien lain (mobile belum dibangun, tool MCP TULIS)
  bisa bikin/ubah Periode tanpa lewat desktop dulu — prinsip
  "Worker = satu-satunya penulis D1 production" yang sudah dipegang
  `debts`/`transactions`/investasi.
- Query ringkasan on-the-fly perlu versi Worker (query D1) DAN versi
  MCP (`sync-snapshot.ts`, port rumus yang sama dari snapshot
  `/sync`), bukan cuma sisi desktop.
- **BELUM DIMULAI SAMA SEKALI** — `useCreateCategoryPeriod` saat ini
  murni tulis ke SQLite lokal, TIDAK ADA panggilan `pushOnWrite`.
  Tabel `category_periods`/`category_period_categories` juga BELUM
  terdaftar di `QueueableTable` (`shared/cloud-sync/push-queue/types.ts`)
  — memanggil `pushOnWrite` apa adanya sekarang akan gagal type-check.
  Detail lintas-app (tahapan, endpoint, tool MCP) ditulis di dokumen
  masing-masing app, LIHAT index di
  [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
  — jangan duplikasi di sini. Dokumen index itu JUGA masih
  menyebut skema LAMA (`category_id` tunggal) di beberapa tempat —
  perlu disinkronkan menyusul skema `0048` kalau mau dipakai sbg
  rujukan detail Worker/MCP.

## Catatan

- Proyek ini portofolio-only, tidak ada deadline/urgensi.
- CRUD desktop (create/edit/delete + list/filter/sort) SUDAH FINAL
  (2026-10-11) — bentuk data & UX sisi desktop tidak lagi berubah.
  Kerja berikutnya yang tersisa: wiring Worker/MCP, dimulai dari
  bikin tabel D1 + endpoint di `apps/worker` (pola sama
  `investment-sync.md`), baru daftarkan ke `QueueableTable`/
  `DeletableTable` dan sambungkan `pushOnWrite`/`pushDeleteOnWrite`
  di hook desktop yang sudah ada.

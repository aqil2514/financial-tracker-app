# Periode Kategori (Category Period) — Desktop

> Detail implementasi sisi desktop utk fitur lintas-app "Periode
> Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Skema DB + form create (UI) SELESAI (2026-10-11) — lihat "Rencana
pendekatan" di bawah utk detail teknis & revisi desain yang terjadi
di tengah jalan (many-to-many kategori). Sisanya (list/ringkasan
periode, edit/delete, wiring push) masih tahap rencana.

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
  `PeriodPicker`). Dialog (`CreateCategoryPeriodDialog`) trigger+
  dialog menyatu dalam satu komponen, state dari context lokal
  (`CategoryPeriodDialogProvider`, `provider/dialog-state/`).
  Diverifikasi jalan di app (`tauri dev`), termasuk 1 bug runtime
  ditemukan+diperbaiki (lihat catatan di bawah).
- [x] Hook `useCategoryPeriods`(query, JOIN ke pivot) +
  `useCreateCategoryPeriod` (mutation, insert periode lalu loop
  insert pivot). Query key domain sendiri (`categoryPeriods`) di
  `QUERY_DEPENDENCIES`.
- [ ] List periode + ringkasan (total masuk/keluar/selisih + daftar
  transaksi) di tab Periode — section masih placeholder "Segera
  hadir.", BELUM ada tampilan baca sama sekali (baru jalur tulis/
  create yang ada).
- [ ] Edit & delete periode.
- [ ] Wiring push ke `apps/worker` (`pushOnWrite`/`pushDeleteOnWrite`)
  utk `category_periods` DAN `category_period_categories` di titik
  mutasi — belum disentuh sama sekali, `useCreateCategoryPeriod`
  murni tulis lokal SQLite saat ini.

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

Masih TANPA tabel ledger/history transaksi terpisah — ringkasan
(total masuk, total keluar, selisih, daftar transaksi) tetap
**dihitung on-the-fly**, sekarang dari
`transactions WHERE category_id IN (SELECT category_id FROM
category_period_categories WHERE period_id = ?) AND date BETWEEN
start_date AND end_date`, sama prinsip dengan `accounts.balance`
yang derived. Query ini BELUM diimplementasikan (lihat checklist).

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
│       ├── index.tsx          — CategoryPeriodSection
│       ├── dialogs/
│       │   └── create.tsx     — CreateCategoryPeriodDialog (trigger+dialog menyatu)
│       ├── form/
│       │   ├── index.tsx      — CategoryContentPeriodForm
│       │   └── schema/        — categoryPeriodSchema, defaultValues
│       └── hooks/
│           ├── use-category-periods.ts
│           └── use-create-category-period.ts
└── index.ts                   — barrel (export dari content/list/{list,form})
```

Isi tab Periode saat ini: cuma dialog "Tambah Periode" (create) yang
sudah bisa jalan penuh. List periode + ringkasan SAAT INI masih
placeholder teks "Segera hadir." — belum ada tampilan baca sama
sekali.

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
- Urutan kerja yang disarankan: selesaikan dulu list/ringkasan
  periode + edit/delete di desktop (supaya bentuk data & UX final),
  baru lanjut wiring Worker/MCP — pola sama `investment-sync.md`.

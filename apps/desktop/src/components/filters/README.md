# Filter System

Sistem filter generik bergaya "key → operator → value" (mirip query builder), diadaptasi dari `_shared/filters` di proyek `retail-multitenant`, tapi dipangkas jauh lebih sederhana: tanpa sinkronisasi ke URL, tanpa `filter.config.ts` terpisah, dan setiap tipe field dibangun bertahap sesuai kebutuhan nyata (bukan semua tipe sekaligus di awal).

## Konsep inti: 3 nilai per filter

Setiap filter aktif direpresentasikan oleh `FilterConfig` (`filter.interface.ts`):

```ts
interface FilterConfig {
  filterKey: string;        // field mana yang difilter, mis. "note", "type"
  filterOperator: FilterOperatorType; // cara membandingkan, mis. "ilike", "eq"
  filterValue: FilterValueType;       // nilai pembanding
}
```

Analoginya: `filterKey` = kolom di database, `filterOperator` = operator SQL (`LIKE`, `=`, `IN`, dst), `filterValue` = nilai di sisi kanan operator.

## Dua level konfigurasi — jangan tertukar

Ini sumber kebingungan paling umum, jadi ditegaskan di sini:

- **`FilterKeyOption`** (`panel/panel.interface.ts`) — daftar STATIS field yang BISA difilter di suatu halaman. Disiapkan sekali oleh pemanggil (mis. `transaction-list.tsx`), berisi `key`, `label`, dan `type` (`"text" | "select" | "combobox" | "number" | "date"`). Ibarat daftar menu.
- **`FilterConfig`** (`filter.interface.ts`) — satu baris filter yang SEDANG dipilih/diisi user, disimpan di `snapshot` (draft) dan `activeValue`/`initialValue` (yang sudah diterapkan). Ibarat pesanan yang dibuat dari menu itu.

`FilterConfig` **tidak** membawa `type` — nilai itu selalu di-*lookup* dari `FilterKeyOption` berdasarkan `filterKey` (lihat `content.tsx`: `config.find(c => c.key === snap.filterKey)?.type`). Ini keputusan sadar, bukan kelalaian: satu sumber kebenaran untuk `type`, tidak ada duplikasi yang bisa tidak sinkron antara `config` dan `snapshot`.

## Struktur folder

```
filters/
├── filter.interface.ts       — kontainer generik: FilterConfig, FilterValueType,
│                                FilterOperatorType (+ subset per tipe), SelectOption
├── panel/                    — orkestrasi UI: popover trigger, daftar filter aktif,
│   │                            tombol tambah/terapkan, context/provider
│   ├── panel.interface.ts    — FilterKeyOption, SelectOptionsMap, context type
│   ├── provider.tsx          — FilterPanelProvider + useFilterPanel() (React context)
│   ├── index.tsx             — FilterPanel: trigger (ikon+badge) + Popover shell
│   ├── content.tsx           — render satu komponen per baris snapshot, sesuai `type`
│   └── footer.tsx            — tombol "Tambah Filter" & "Terapkan Filter"
├── text/                     — implementasi UI untuk field bertipe "text"
│   ├── operator.tsx          — dropdown operator (Berisi kata/Tidak berisi kata/Kosong/dst)
│   ├── input.tsx             — input teks + tombol clear
│   └── index.tsx             — FilterText: orchestrator (key selector + operator + input)
├── select/                   — implementasi UI untuk field bertipe "select"
│   ├── operator.tsx          — dropdown operator (Adalah/Bukan/Kosong/dst)
│   ├── input.tsx             — Select multi-select native (base-ui `multiple`)
│   └── index.tsx             — FilterSelect: orchestrator
├── combobox/                 — implementasi UI untuk field bertipe "combobox"
│   │                            (sama semantik operator dengan "select", TAPI
│   │                            untuk field dengan opsi BANYAK — searchable,
│   │                            bukan cuma dropdown. Pilih "select" kalau opsi
│   │                            sedikit & tidak perlu dicari, mis. tipe transaksi
│   │                            income/expense/transfer; pilih "combobox" kalau
│   │                            opsi bisa puluhan/ratusan, mis. kategori/akun)
│   ├── operator.tsx          — dropdown operator (Adalah/Bukan/Kosong/dst),
│   │                            union operator SAMA dengan select (SelectOperatorType)
│   ├── input.tsx             — base-ui Combobox multi-select bergaya chip
│   │                            (ComboboxChips/ComboboxChip/ComboboxChipsInput),
│   │                            item combobox berupa objek SelectOption utuh
│   │                            (base-ui otomatis resolve label dari bentuk
│   │                            {value, label}), dikonversi ke/dari string[]
│   │                            di titik masuk/keluar komponen ini
│   └── index.tsx             — FilterCombobox: orchestrator
├── number/                   — implementasi UI untuk field bertipe "number"
│   ├── operator.tsx          — dropdown operator (Sama dengan/Lebih besar dari/
│   │                            Di antara/Kosong/dst)
│   ├── input.tsx             — satu input angka untuk operator tunggal (eq, gt,
│   │                            dst), atau dua input "Dari"/"Sampai" saat operator
│   │                            between/not_between — dipilih lewat prop `isRange`
│   │                            (ditentukan orchestrator dari operator, bukan
│   │                            ditebak dari bentuk value)
│   └── index.tsx             — FilterNumber: orchestrator
└── builders/                 — konsumsi FilterConfig[] menjadi sesuatu yang siap
    └── sql.ts                  pakai di luar UI. Satu file per target output —
                                 TIDAK dikelompokkan per tipe field (sql.ts berlaku
                                 untuk field text maupun select sekaligus, karena
                                 generik berdasarkan operator, bukan berdasarkan
                                 tipe field). Builder lain (mis. url.ts untuk sinkron
                                 ke query string, memory.ts untuk filter array JS
                                 murni) akan ditambah sebagai file baru di folder
                                 ini kalau/ketika dibutuhkan.
```

Folder `date/` belum dibangun — akan mengikuti pola yang sama persis ketika dibutuhkan (lihat "Menambah tipe field baru" di bawah).

## Alur data

```
Pemanggil (mis. transaction-list.tsx)
  ├─ FILTER_CONFIG: FilterKeyOption[]         → field apa saja yang bisa difilter
  ├─ FILTER_SELECT_OPTIONS: SelectOptionsMap  → opsi value untuk field bertipe select
  ├─ filters: FilterConfig[] (useState)       → filter yang SUDAH diterapkan
  └─ <FilterPanel config selectOptions initialValue={filters} onApplyFilter={setFilters} />
        │
        ▼
  FilterPanelProvider (context: config, selectOptions, snapshot, activeValue, ...)
        │
        ▼
  FilterPanelInner (trigger tombol "Filter" + badge activeValue.length, buka Popover)
        │
        ├─ FilterPanelContent  → loop `snapshot`, lookup `type` dari `config`,
        │                         render FilterText / FilterSelect sesuai `type`
        └─ FilterPanelFooter   → "Tambah Filter" (push FilterConfig baru dari field
                                  yang belum dipakai) & "Terapkan Filter" (panggil
                                  onApplyFilter(snapshot), tutup popover)
```

Poin penting soal timing:

- **`snapshot`** adalah draft yang diedit bebas di dalam popover — TIDAK memengaruhi data di luar sampai "Terapkan Filter" diklik.
- **`activeValue`** (alias `initialValue` dari pemanggil) adalah filter yang benar-benar berlaku. Dipakai untuk badge jumlah filter di trigger, dan untuk mereset `snapshot` setiap popover dibuka lagi (`useEffectEvent` di `provider.tsx`) — supaya draft yang ditinggal tanpa diterapkan tidak nyangkut.

## Komponen per tipe field HARUS controlled, TIDAK BOLEH baca context

`FilterText`, `FilterSelect`, `FilterNumber` (dan `FilterDate` nanti) sengaja dirancang sebagai *controlled component* murni: terima `state: FilterConfig` + `onChange` lewat props, tidak pernah memanggil `useFilterPanel()` di dalamnya.

Ini bukan detail implementasi sepele — ini yang memungkinkan `FilterText`/`FilterSelect` dipakai **tanpa** `FilterPanel` sama sekali (misalnya taruh langsung di suatu halaman dengan `useState` lokal biasa), kalau suatu saat dibutuhkan UI filter tunggal tanpa popover/multi-filter. Context (`useFilterPanel`) hanya boleh dipakai di lapisan `panel/`, tidak boleh bocor ke komponen per-tipe.

## Jebakan yang sudah ditemukan (baca sebelum menambah `Select` baru)

Base-ui `Select`'s `SelectValue` **tidak** otomatis membaca label dari `children` `SelectItem` yang di-render. Kalau `Select` tidak diberi prop `items` (array `{value, label}` atau `Record<value, label>`), trigger akan fallback menampilkan **value mentah** (mis. `"is_null"`, `"eq"`) alih-alih label yang seharusnya (mis. `"Kosong"`, `"Adalah"`).

**Aturan wajib**: setiap kali membuat `<Select>` baru di folder ini (atau di mana pun di aplikasi), selalu sertakan prop `items`:

```tsx
<Select value={value} items={OPTIONS} onValueChange={onChange}>
  ...
  {OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
</Select>
```

Bug ini sempat muncul dua kali berturut-turut (di `text/operator.tsx` dan `text/index.tsx`) sebelum polanya disadari — kemungkinan ada pemakaian `Select` lain di aplikasi (di luar folder ini) yang belum diaudit dan berisiko sama.

## Operator default per tipe field

Saat tombol "Tambah Filter" diklik (`panel/footer.tsx`), operator default harus sesuai tipe field yang dipilih — `"eq"` valid untuk `select`, tapi BUKAN operator valid untuk `text` (yang hanya punya `ilike`/`not_ilike`/`is_null`/`is_not_null`). Dipetakan lewat `DEFAULT_OPERATOR: Record<FilterFieldType, FilterOperatorType>` di `footer.tsx`. Kalau menambah tipe field baru, tambahkan juga entrinya di map ini.

## Konversi tipe value (kenapa ada banyak `as` dan pengecekan `typeof`)

`FilterConfig.filterValue` bertipe `FilterValueType` (union luas: `string | number | boolean | null | string[] | number[] | FilterRangeValue`) supaya satu `FilterConfig` bisa menampung nilai dari tipe field apa pun. Konsekuensinya, tiap komponen per-tipe (`FilterText`, `FilterSelect`, dst) harus mempersempit sendiri ke tipe yang dia butuhkan sebelum dipakai:

```ts
// text/index.tsx
const value = typeof state.filterValue === "string" ? state.filterValue : "";

// select/index.tsx
const value = Array.isArray(state.filterValue) ? state.filterValue.map(String) : [];

// number/index.tsx — dua kemungkinan bentuk (angka tunggal atau FilterRangeValue),
// mana yang dipakai (`value` vs `rangeValue`) ditentukan orchestrator dari
// OPERATOR (between/not_between = range), bukan ditebak dari bentuk value
const value = typeof state.filterValue === "number" ? state.filterValue : null;
const rangeValue =
  state.filterValue && typeof state.filterValue === "object" && !Array.isArray(state.filterValue)
    ? (state.filterValue as FilterRangeValue)
    : EMPTY_RANGE;
```

Ini pola yang disengaja (bukan yang ideal secara type-safety murni, tapi paling sederhana untuk `FilterConfig` yang satu bentuk untuk semua tipe) — jangan coba "perbaiki" dengan generic yang rumit tanpa alasan kuat.

## Menambah tipe field baru (mis. `date`)

Ikuti urutan yang sudah terbukti untuk `text`, `select`, `combobox`, dan `number`:

1. Tambah subset operator ke `filter.interface.ts` (pola: `export type NumberOperatorType = ...`, lalu masukkan ke union `FilterOperatorType`).
2. Buat folder baru (`number/`), isi bertahap: `operator.tsx` (dropdown operator, jangan lupa prop `items`) → `input.tsx` (kontrol value spesifik tipe itu) → `index.tsx` (orchestrator, controlled component, tanpa baca context).
3. Tambahkan `DEFAULT_OPERATOR[<tipe baru>]` di `panel/footer.tsx`.
4. Uncomment (atau tambahkan) cabang `if (fieldType === "<tipe baru>")` di `panel/content.tsx`.
5. Terapkan penanganan `filterKey`/`filterOperator` untuk field itu di query SQL pemanggil (lihat pola di `use-transactions.ts`).

## `builders/` — dari `FilterConfig[]` ke sesuatu yang bisa dipakai

Hasil akhir dari seluruh sistem panel/UI ini cuma satu: array `FilterConfig[]`. Tapi array itu sendiri tidak bisa langsung dipakai query — perlu diterjemahkan dulu ke bentuk yang dimengerti target penyimpanan datanya (SQL, query string URL, filter array JS, dst). Itulah peran `builders/`.

**Kenapa builder, bukan ditulis manual tiap kali?** Sebelum `builders/sql.ts` ada, `use-transactions.ts` menulis loop `if (filter.filterKey === "note") {...} if (filter.filterKey === "type") {...}` secara manual — kalau ada `use-accounts.ts` atau `use-categories.ts` yang juga butuh filter nanti, loop yang sama akan ditulis ulang lagi dan lagi. `buildWhereClause` menggantikan itu dengan satu fungsi generik berdasarkan `filterOperator` (bukan nama kolom), jadi berlaku untuk field APA PUN asal operatornya dikenali — tidak perlu tahu itu "note" atau "type" atau field lain.

**`builders/sql.ts`** — `buildWhereClause(filters, allowedColumns, extraConditions?)`:

- Mengembalikan `{ whereClause: string, params: (string|number)[] }` — **langsung siap pakai**, bukan potongan yang masih perlu di-join manual. `whereClause` sudah termasuk kata `"WHERE ..."` (string kosong kalau tidak ada kondisi sama sekali), tinggal disisipkan langsung ke template query.
- **`allowedColumns` wajib diisi** — whitelist nama kolom yang sah untuk tabel terkait. `filterKey` disisipkan LANGSUNG sebagai nama kolom SQL (SQLite tidak bisa mem-bind nama kolom lewat parameter `$1`, `$2`, dst — cuma value yang bisa), jadi tanpa whitelist ini, `filterKey` yang salah sasaran atau (di masa depan) berasal dari sumber kurang terpercaya bisa jadi celah SQL injection lewat nama kolom. Definisikan whitelist ini di file yang sama dengan query-nya (lihat `FILTERABLE_COLUMNS` di `use-transactions.ts`) dan pastikan selalu sinkron dengan `FILTER_CONFIG` di komponen pemanggil.
- **`extraConditions`** (opsional) untuk kondisi di luar sistem `FilterConfig` yang perlu ikut digabung ke `whereClause` yang sama — mis. filter tanggal dari kalender, yang bukan bagian dari filter panel. Tiap entri `{ condition: string, params?: (string|number)[] }`; nomor parameter (`$1`, `$2`, dst) ditulis relatif terhadap urutan `extraConditions` itu sendiri (selalu ditempatkan duluan, sebelum kondisi dari `filters`) — jadi pemanggil tidak perlu menghitung offset manual sama sekali.
- Sudah menangani seluruh operator `text`/`select`/`number` yang ada saat ini (termasuk `gt`/`gte`/`lt`/`lte` dan `between`/`not_between` untuk range). Operator yang belum dikenali (mis. saat tipe field baru seperti `date` ditambahkan tapi builder belum diperbarui) sengaja **melempar error**, bukan diam-diam diabaikan — supaya kesalahannya cepat ketahuan saat testing, bukan jadi bug senyap di production (filter yang terlihat "diterapkan" tapi sebenarnya tidak berefek).

**Menambah builder baru**: kalau nanti dibutuhkan konsumsi ke target lain, tambahkan file baru sejajar (`builders/url.ts`, `builders/memory.ts`, dst) — jangan dikelompokkan per tipe field (`text.ts`/`select.ts`) karena satu builder pada dasarnya berlaku lintas tipe field selama operatornya dikenali.

## Menghubungkan ke pemanggil (contoh: halaman Transaksi)

```tsx
const FILTER_CONFIG: FilterKeyOption[] = [
  { key: "note", label: "Catatan", type: "text" },
  { key: "type", label: "Tipe Transaksi", type: "select" },
];

const FILTER_SELECT_OPTIONS: SelectOptionsMap = {
  type: [
    { value: "income", label: "Pemasukan" },
    { value: "expense", label: "Pengeluaran" },
    { value: "transfer", label: "Transfer" },
  ],
};

const [filters, setFilters] = useState<FilterConfig[]>([]);

<FilterPanel
  config={FILTER_CONFIG}
  selectOptions={FILTER_SELECT_OPTIONS}
  initialValue={filters}
  onApplyFilter={setFilters}
/>
```

Lalu di query (`use-transactions.ts`), pakai `buildWhereClause` dari `builders/sql.ts` — bukan loop manual per `filter.filterKey`:

```ts
const FILTERABLE_COLUMNS = ["note", "type"] as const; // sinkron dengan FILTER_CONFIG

const { whereClause, params } = buildWhereClause(
  filters,
  FILTERABLE_COLUMNS,
  date ? [{ condition: "date(date) = $1", params: [date] }] : []
);

db.select(`SELECT * FROM transactions ${whereClause} ...`, params);
```

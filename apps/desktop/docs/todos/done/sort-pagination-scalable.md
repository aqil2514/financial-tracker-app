# Sort & Pagination yang Scalable

## Latar belakang

Sistem filter (`components/filters/`) sudah generik: `FilterConfig` sebagai
kontrak, `buildWhereClause` sebagai builder berdasarkan operator (bukan nama
kolom), jadi menambah field filter baru tinggal konfigurasi tanpa sentuh
builder. Sort di transaksi (`use-transactions.ts`) sebelumnya belum
mengikuti pola yang sama — masih ditulis ad-hoc per fitur.

## Masalah sebelumnya

**Sorting** — jauh dari generik:
- `TransactionSort` adalah union literal per kombinasi kolom+arah
  (`"date_desc" | "date_asc" | "amount_desc" | "amount_asc"`), bukan bentuk
  generik seperti `FilterOperatorType`.
- `SORT_CLAUSES: Record<TransactionSort, string>` di `use-transactions.ts`
  memetakan tiap literal ke klausa SQL manual — menambah sort kolom baru
  berarti menambah literal baru DAN entry baru di map ini, tidak reusable
  ke fitur lain sama sekali.
- Tidak ada builder setara `buildWhereClause` untuk `ORDER BY`.
- UI sorter sudah dilepas dari `TransactionList` sejak filter system
  dibangun — belum ada UI sort sama sekali.

**Pagination** — komponen UI-nya (`TablePagination`) sudah cukup generik,
tapi sisi query-nya menulis index parameter manual:
`LIMIT $${params.length + 1} OFFSET $${params.length + 2}` — pola yang
SAMA PERSIS dengan kelas bug yang sudah dua kali terjadi di
`buildWhereClause` (index placeholder salah hitung saat `.map()` dipanggil
sebelum `params.push()`). Sempat dinilai "terlalu sederhana untuk
dibuatkan abstraksi" di iterasi awal dokumen ini, tapi keputusan itu
DIREVISI (lihat "Keputusan yang diambil") setelah disadari risikonya
sama nyata dengan alasan `buildOrderClause` dibuat.

## Sudah dieksekusi

**Struktur folder** — `filters/`, `sort/`, dan `table-pagination.tsx`
dikelompokkan jadi satu family `components/query/` (`query/filters/`,
`query/sort/`, `query/pagination/`) karena ketiganya sama-sama menentukan
bagaimana/apa data query ditampilkan (WHERE, ORDER BY, LIMIT/OFFSET).
`lib/pagination.ts` (`toPagination`, logic murni tanpa UI) TETAP di `lib/`
— tidak ikut pindah, karena bukan komponen.

**`SortConfig` generik** — dibuat `components/query/sort/sort.interface.ts`:
```ts
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  sortKey: string;
  sortDirection: SortDirection;
}

export interface SortKeyOption {
  key: string;
  label: string;
}
```
`sorts: SortConfig[]` (array, mendukung multi-sort) menggantikan
`TransactionSort` union — dipilih multi-sort dari awal karena union literal
per kombinasi kolom (pendekatan lama) tidak scale sama sekali begitu ada
>1 kolom yang bisa disortir sekaligus.

**Builder `buildOrderClause`** — `components/query/sort/builders/sql.ts`,
sejajar `buildWhereClause` di `filters/builders/sql.ts`: whitelist kolom
lewat `allowedColumns` (pola yang sama untuk mencegah SQL injection lewat
nama kolom), fallback ke `defaultClause` kalau `sorts` kosong, mendukung
multi-sort (`ORDER BY colA ASC, colB DESC`). Diuji di `sql.test.ts` (4
test: default clause, single-column, multi-column, unknown-column throws).

Nama file builder sengaja `sql.ts` di ketiga folder (`filters/`, `sort/`,
`pagination/`), BUKAN `order.ts`/`limit-offset.ts` seperti awalnya —
mengikuti konvensi yang sudah didokumentasikan di
`filters/README.md`: nama file builder = TARGET output (SQL, nanti bisa
`url.ts`/`graphql.ts`/dst kalau dibutuhkan), bukan konsep SQL-nya sendiri
(ORDER BY, LIMIT/OFFSET). Nama fungsinya (`buildOrderClause`,
`buildLimitOffset`) tetap deskriptif seperti semula — yang diseragamkan
cuma nama file-nya.

**Integrasi ke `use-transactions.ts`** — `TransactionSort` union dan
`SORT_CLAUSES` map dihapus, diganti `sorts: SortConfig[]` + `SORTABLE_COLUMNS
= ["date", "amount"]` + `buildOrderClause(sorts, SORTABLE_COLUMNS, "date
DESC, id DESC")`.

**UI sorter** — dibuat `components/query/sort/sort-dropdown.tsx` (`SortDropdown`):
dropdown sederhana (bukan infrastruktur sebesar filter panel — tidak pakai
provider/snapshot terpisah), controlled langsung lewat `value`/`onChange`.
Tiap baris pilih kolom (`Select`) + arah (`ToggleGroup` Naik/Turun), bisa
tambah baris untuk multi-sort, kolom yang sudah dipakai di-disable di baris
lain supaya tidak dobel. Dipasang di `list-card-header.tsx` di samping
`FilterPanel`, state `sorts`/`setSorts` hidup di `ListContext`
(`list-context.tsx`) — pola yang sama seperti `filters`/`setFilters`.

Sempat ada bug label mentah ("amount"/"date" tampil apa adanya di trigger)
karena `items` prop `Select` dikasih `config` (`{key, label}`) langsung,
padahal `base-ui Select` butuh bentuk `{value, label}` — bug yang sama
persis seperti yang sudah didokumentasikan di
`components/query/filters/README.md`. Fix:
`items={config.map((opt) => ({ value: opt.key, label: opt.label }))}`.

**Builder `buildLimitOffset`** — `components/query/pagination/builders/sql.ts`,
sejajar `buildOrderClause`/`buildWhereClause`: terima `page`, `limit`,
`startIndex` (posisi placeholder pertama yang boleh dipakai, biasanya
`params.length + 1` dari whereClause yang sudah dibangun), kembalikan
`{ clause: "LIMIT $n OFFSET $m", params: [limit, offset] }` — pemanggil
tidak perlu menghitung index parameter manual sama sekali. Diuji di
`limit-offset.test.ts` (4 test: index dari awal, offset dari page/limit,
lanjut index dari startIndex custom, offset 0 di page 1). Diterapkan ke
`use-transactions.ts`, menggantikan `LIMIT $${params.length + 1} OFFSET
$${params.length + 2}` yang ditulis manual.

## Keputusan yang diambil

- **Multi-sort dari awal**, bukan single-sort — `SortConfig[]` array,
  bukan objek tunggal.
- **Backend + UI dropdown sederhana dikerjakan sekaligus**, bukan backend
  dulu lalu UI menyusul terpisah.
- **Pagination DIBUATKAN builder juga** (`buildLimitOffset`) — keputusan
  awal ("terlalu sederhana untuk diabstraksi") DIREVISI setelah disadari
  pola `params.length + 1`/`+2` manual punya risiko yang sama persis
  dengan kelas bug index placeholder yang sudah dua kali terjadi di
  `buildWhereClause`. "Sederhana" bukan alasan valid untuk skip builder
  kalau kelas kesalahannya sama nyata.
- **Struktur folder disatukan** — `filters/`, `sort/`, `table-pagination`
  dipindah ke satu family `components/query/` karena ketiganya sama-sama
  menentukan bentuk data query (WHERE/ORDER BY/LIMIT-OFFSET), meski cuma
  filters dan sort yang punya builder SQL — pagination tetap masuk family
  ini secara konsep, bukan cuma yang punya builder.

## Catatan

Filter system sudah menunjukkan pola yang terbukti bekerja (config generik
→ builder generik berdasarkan operator, bukan nama kolom) — sort dan
pagination mengikuti pola arsitektur yang sama
(`SortConfig`/`buildOrderClause`/`SortKeyOption`,
`buildLimitOffset` sejajar `FilterConfig`/`buildWhereClause`/`FilterKeyOption`)
tapi TIDAK meniru filter 1:1 di sisi UI — `SortDropdown` sengaja jauh
lebih sederhana dari `FilterPanel` karena kompleksitasnya memang tidak
sepadan (tidak perlu provider/snapshot/popover-per-tipe-field), dan
pagination tidak butuh UI baru sama sekali (`TablePagination` sudah ada
dan sudah generik sejak awal).

Kalau fitur lain (accounts, dst) nanti butuh sorting/pagination dengan
filter, tinggal pakai `buildOrderClause`/`buildLimitOffset`/`SortDropdown`
yang sudah generik — tidak perlu menulis builder atau UI baru dari nol,
dan tidak perlu menghitung index parameter SQL secara manual.

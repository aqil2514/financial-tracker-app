# Sort & Pagination yang Scalable

## Latar belakang

Sistem filter (`components/filters/`) sudah generik: `FilterConfig` sebagai
kontrak, `buildWhereClause` sebagai builder berdasarkan operator (bukan nama
kolom), jadi menambah field filter baru tinggal konfigurasi tanpa sentuh
builder. Sort dan pagination di transaksi (`use-transactions.ts`) belum
mengikuti pola yang sama — keduanya masih ditulis ad-hoc per fitur.

## Masalah saat ini

**Sorting** — jauh dari generik:
- `TransactionSort` adalah union literal per kombinasi kolom+arah
  (`"date_desc" | "date_asc" | "amount_desc" | "amount_asc"`), bukan bentuk
  generik seperti `FilterOperatorType`.
- `SORT_CLAUSES: Record<TransactionSort, string>` di `use-transactions.ts`
  memetakan tiap literal ke klausa SQL manual — menambah sort kolom baru
  (mis. sort by kategori) berarti menambah literal baru DAN entry baru di
  map ini, tidak reusable ke fitur lain (`use-accounts.ts`, dst) sama
  sekali.
- Tidak ada builder setara `buildWhereClause` untuk `ORDER BY` — kalau
  fitur lain butuh sorting, pola manual ini akan ditulis ulang.
- UI sorter sendiri sudah dilepas dari `TransactionList` sejak filter
  system dibangun (lihat komentar `// TODO: sorter sedang disusun ulang
  bertahap mengikuti pola panel/ yang baru, sementara dilepas dari UI` di
  `list/list-card-header.tsx`) — belum ada UI sort sama sekali saat ini.

**Pagination** — komponen UI-nya (`TablePagination`) sudah cukup generik
(terima `pagination`, `onPageChange`, `onLimitChange` sebagai props, tidak
tahu soal transaksi/akun/kategori), TAPI sisi query-nya belum:
- Klausa `LIMIT $n OFFSET $m` ditulis manual di tiap `use-*.ts` (lihat
  `use-transactions.ts`: `LIMIT $${params.length + 1} OFFSET
  $${params.length + 2}`) — polanya gampang salah hitung index parameter
  kalau ditulis ulang di fitur lain (mirip bug yang pernah terjadi di
  `buildWhereClause` untuk placeholder `eq`/`neq` multi-value).

## Kemungkinan arah perbaikan (belum diputuskan)

- **`SortConfig` generik**, setara `FilterConfig`:
  ```ts
  interface SortConfig {
    sortKey: string;
    sortDirection: "asc" | "desc";
  }
  ```
  Field mana yang bisa disortir didefinisikan lewat semacam
  `SortKeyOption[]` (menu, mirip `FilterKeyOption`), bukan union literal
  per kombinasi.
- **Builder `buildOrderClause(sorts, allowedColumns)`** — sejajar
  `buildWhereClause` di `builders/sql.ts` (atau file baru
  `builders/order.ts`), whitelist kolom dengan pola yang sama
  (`allowedColumns`) untuk mencegah SQL injection lewat nama kolom sort.
  Mendukung multi-sort (`ORDER BY colA ASC, colB DESC`) kalau dibutuhkan,
  atau single-sort dulu kalau itu cukup untuk kasus nyata yang ada.
- **Util pagination**: `buildLimitOffset(page, limit, startIndex)` kecil di
  `builders/` (atau tetap ditulis manual kalau ternyata cuma satu baris dan
  tidak sepadan dibuatkan abstraksi — perlu dinilai ulang saat
  implementasi, jangan buat abstraksi kalau cuma dipakai sekali).
- **UI sorter**: setelah `SortConfig` ada, bangun `components/sort/`
  mengikuti pola yang sama seperti `components/filters/` (panel + provider
  + orchestrator per tipe field), atau — kalau ternyata sort selalu simple
  (satu kolom, dua arah) — cukup dropdown sederhana tanpa perlu
  infrastruktur sebesar filter. Perlu dinilai proporsinya saat mulai
  dikerjakan, jangan langsung tiru struktur filter kalau kompleksitasnya
  tidak sepadan.

## Catatan

Filter system sudah menunjukkan pola yang terbukti bekerja (config generik
→ builder generik berdasarkan operator, bukan nama kolom) — sort dan
pagination sebaiknya mengikuti pola arsitektur yang sama supaya konsisten,
tapi TIDAK perlu meniru filter 1:1 kalau kompleksitas sort ternyata jauh
lebih sederhana (mis. cuma butuh satu kolom sort aktif dalam satu waktu,
beda dengan filter yang bisa banyak kondisi sekaligus).

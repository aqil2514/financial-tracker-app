# Audit Kandidat Scalable Lintas Fitur

## Latar belakang

Setelah sistem filter (`components/filters/`) dan rencana sort/pagination
(`sort-pagination-scalable.md`), dilakukan audit lintas fitur
(`transactions`, `accounts`, `account-groups`, `categories`, `dashboard`,
`reports`, `data-import`) untuk mencari pola lain yang diulang manual per
fitur padahal bisa jadi abstraksi generik — dengan semangat yang sama
seperti `buildWhereClause`: config generik + satu implementasi, bukan
copy-paste per fitur.

## Sudah dieksekusi

**Konfirmasi delete sebelum hapus data** — ditemukan bahwa tombol hapus di
`account-group-list.tsx`, `account-list.tsx`, dan
`transactions/list/transaction-list-item.tsx` semuanya memanggil
`deleteX.mutate(id)` LANGSUNG dari `onClick`, tanpa dialog konfirmasi sama
sekali — risiko kehilangan data nyata (sekali salah klik ikon tempat
sampah, data langsung hilang). `AlertDialog` (`components/ui/alert-dialog.tsx`)
sudah ada di codebase tapi cuma dipakai untuk `data-import`, tidak pernah
untuk delete per-baris.

Dibuat `components/confirm-delete-button.tsx` — `ConfirmDeleteButton`
generik (props: `onConfirm`, `isPending?`, `title?`, `description?`),
membungkus `AlertDialog` + tombol trash. Dipasang di ketiga tempat di atas,
menggantikan tombol `Trash2` telanjang.

**Boilerplate loading/error (poin 3 lama)** — dibuat
`components/query-state.tsx` — `QueryState` generik (props: `isLoading?`,
`error?` menerima `unknown` jadi tidak perlu `as Error` manual lagi,
`loadingText?`). Dipasang menggantikan pola `{isLoading && <p>...}
{error && <p>...}` di seluruh 10 lokasi yang disebut di bawah.

**Currency tidak lagi hardcode Rupiah** — di luar daftar kandidat semula
(muncul dari pertanyaan spontan saat menyentuh `lib/format.ts`), tapi
levelnya sepadan: `formatRupiah` diganti jadi `formatCurrency(value,
currency: SupportedCurrency)` di file baru `lib/format-currency.ts`,
locale mengikuti mata uang aslinya (`CURRENCY_LOCALE` map — IDR pakai
id-ID, USD pakai en-US, dst) supaya nominal tidak salah dibaca kalau
akun valas (lihat `account-type.md`) nanti benar dibangun. Semua 11
pemanggil lama diupdate wajib isi currency eksplisit (`"IDR"` untuk
semuanya saat ini, tidak ada default tersembunyi).

**`Intl` mentah untuk sumbu/label chart** — ditambahkan `formatCompactNotation`
di `lib/format.ts` (notasi ringkas "1,2 jt" untuk tick sumbu chart) dan
`formatDate(value, "month-label")` di `lib/format-date.ts` (label bulan
pendek "Sep 26"). Menggantikan inline `Intl.NumberFormat`/
`Intl.DateTimeFormat` di `reports/account-balance-chart.tsx`,
`reports/monthly-summary-chart.tsx` (2 pemakaian sekaligus — sumbu Y dan
label bulan lokal yang sebelumnya didefinisikan ulang di file yang sama).

Perkembangan lanjutan (masih dari menyentuh area format ini): `formatDate`
dan `formatDateTime` lama digabung jadi satu `formatDate(value, style)`
generik (`style: "month-label" | "date-time"`, bisa ditambah tanpa bikin
fungsi baru), dipisah ke file tersendiri `lib/format-date.ts` (pola sama
seperti `format-currency.ts`). Locale semua formatter (`formatDate`,
`formatNumberCompact`, `formatCompactNotation`) juga ditarik ke satu
sumber `lib/locale.ts` (`APP_LOCALE = "id-ID"`) — disiapkan untuk rencana
i18n ke depan, supaya saat itu tiba tinggal ganti sumber `APP_LOCALE`
(baca dari preferensi user/context) tanpa mengubah tiap pemanggil.

**Dialog tambah/edit — shell diseragamkan** — 6 file
(`account-group-form-dialog.tsx`/`account-group-edit-dialog.tsx`,
`account-form-dialog.tsx`/`account-edit-dialog.tsx`,
`transaction-form-dialog.tsx`/`transaction-edit-dialog.tsx`) sebelumnya
punya kerangka `Dialog > DialogTrigger > DialogContent > DialogHeader >
DialogTitle > <Form .../>` yang sama persis, beda cuma teks trigger,
judul, dan form yang dipasang.

Dibuat `components/entity-form-dialog.tsx` — `EntityFormDialog` generik
(props: `trigger`, `title`, `open`, `onOpenChange`, `children`) yang
membungkus shell `Dialog` tadi. Hook data (`useCreateX`/`useUpdateX`) TIDAK
digenericize — tetap spesifik per entitas karena bentuknya belum cukup
seragam (`TransactionFormDialog` punya `onSubmitAndContinue` tambahan yang
tidak dipunyai yang lain) dan memaksakan generic di situ berisiko
membuat abstraksi yang janggal. Hasilnya tiap file dialog menyusut jadi
composition kecil: ambil state dari hook, render `EntityFormDialog` dengan
form spesifik sebagai children.

**`useDbMutation`/`useEntityForm` — data-import dirapikan, categories di-skip** —
`src/hooks/use-db-mutation.ts` dan `use-entity-form.ts` sudah jadi factory
generik yang dipakai benar oleh `account-groups`/`accounts`/`transactions`.
`data-import/use-import-money-manager.ts` sengaja TIDAK dipaksa pakai
`useDbMutation` — bentuknya beda secara fundamental (dua operasi terpisah
`pickFile`/preview dry-run dan `confirmImport`, dengan 2 loading state
berbeda `isPreviewing`/`isImporting`, plus `invoke` Tauri langsung, bukan
`mutationFn` promise biasa yang dipetakan 1:1 ke satu `useMutation`).
Bagian yang dirapikan hanya invalidate 4 query key yang sebelumnya ditulis
manual satu-satu — sekarang jadi satu array `IMPORT_AFFECTED_QUERY_KEYS`
di-loop, supaya menambah query key baru yang perlu ikut invalidate saat
import tidak butuh baris baru terpisah.

`categories/` sengaja di-skip dari daftar ini — belum ada hook
create/update/delete sama sekali karena fitur CUD kategori di UI memang
belum dibangun (bukan inkonsistensi pemakaian hook). Kalau fitur itu nanti
dibangun, langsung pakai `useDbMutation`/`useEntityForm` +
`EntityFormDialog` dari awal, bukan retrofit.

**Invalidasi query key antar-fitur — peta ketergantungan terpusat** —
tiap fitur ekspor `xQueryKey` sendiri (`categoriesQueryKey`,
`accountsQueryKey`, dst — 11 key total). Sebelumnya cross-feature
invalidation dilakukan manual import key fitur lain di tiap mutation.

Saat dipetakan lengkap, ternyata ada BUG STALENESS NYATA di luar soal
maintainability: 7 dari 11 query key (`recentTransactionsQueryKey`,
`currentMonthSummaryQueryKey`, `monthlySummaryQueryKey`,
`categoryBreakdownQueryKey`, `accountBalancesQueryKey`,
`transactionDaysQueryKey`, `monthSummaryQueryKey` — dashboard, reports,
calendar) TIDAK PERNAH masuk ke `invalidateKey` manapun. `QueryClient`
dibuat tanpa `staleTime` khusus (`app/providers.tsx`), jadi query-query
ini hanya refetch lewat refetch-on-mount, bukan invalidasi eksplisit —
kalau komponennya tidak unmount/mount ulang setelah transaksi
ditambah/diubah/dihapus, angkanya bisa basi.

Dibuat `lib/query-dependencies.ts` — `QUERY_DEPENDENCIES` (peta domain →
daftar query key yang bergantung padanya) dan `dependentKeysOf(...domains)`
(gabungan beberapa domain sekaligus tanpa duplikat, dipakai `data-import`
yang menyentuh banyak domain). Domain `transactions` sekarang mencakup
seluruh 7 query turunan yang sebelumnya lolos, plus `accountsQueryKey`
(saldo akun ikut berubah). Domain `accounts` juga menambahkan
`accountBalancesQueryKey` (reports) yang sebelumnya tidak ikut
diinvalidate saat akun diedit/dihapus langsung (bukan lewat transaksi).

Menambah query turunan baru ke depannya cukup daftarkan ke array domain
terkait di `QUERY_DEPENDENCIES` — tidak perlu menyentuh file mutation
manapun, menghilangkan risiko "lupa invalidate" yang jadi alasan awal
kandidat ini diaudit.

## Catatan

Semua 7 kandidat dari audit ini sudah dieksekusi. Urutan pengerjaan
berdasarkan dampak (risiko data loss > duplikasi kode > kerapian
kosmetik), masing-masing dikerjakan saat menyentuh area itu langsung
(bukan refactor besar sekaligus di luar konteks kerja) — termasuk
"Invalidasi query key" yang saat dikerjakan ternyata membongkar bug
staleness nyata, bukan cuma soal kerapian kode.

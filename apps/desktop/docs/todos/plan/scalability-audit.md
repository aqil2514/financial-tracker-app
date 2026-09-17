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

## Kandidat lain (belum dieksekusi, urut prioritas)

### 1. Dialog tambah/edit — 3 pasang file nyaris identik

`account-group-form-dialog.tsx`/`account-group-edit-dialog.tsx`,
`account-form-dialog.tsx`/`account-edit-dialog.tsx`,
`transaction-form-dialog.tsx`/`transaction-edit-dialog.tsx` — 6 file, ~180
baris total, kerangkanya sama persis: `Dialog > DialogTrigger >
DialogContent > DialogHeader > DialogTitle > <Form .../>`. Beda cuma teks
tombol trigger ("Tambah X" vs ikon pensil), judul dialog, dan komponen form
yang dipasang.

Kemungkinan arah: `<EntityFormDialog trigger title form />` generik yang
diparameterisasi oleh hook `useEntityForm`-based yang sudah ada (lihat poin
3) — perlu dicek dulu seberapa seragam bentuk hook return value tiap
fitur sebelum didesain, supaya generic-nya tidak dipaksakan.

### 2. `useDbMutation`/`useEntityForm` sudah ada tapi tidak dipakai konsisten

`src/hooks/use-db-mutation.ts` dan `use-entity-form.ts` sudah jadi factory
generik yang dipakai benar oleh `account-groups`/`accounts`/`transactions`.
Tapi `data-import/use-import-money-manager.ts` menulis ulang pola yang sama
secara manual (`try/catch`, `err instanceof Error ? err.message :
String(err)`, `toast.error`/`toast.success`, invalidate berkali-kali secara
manual) untuk dua pemanggilan `invoke` Tauri-nya, alih-alih compose
`useDbMutation`.

`categories/` juga tidak punya hook create/update/delete sama sekali — perlu
diperjelas apakah ini disengaja (kategori memang fixed, tidak bisa
diubah user) atau memang belum dibangun.

Risiko: karena abstraksi generik ini bukan "satu-satunya cara", fitur baru
bisa diam-diam kembali ke pola manual seperti `data-import` — sama seperti
alasan `buildWhereClause` dibuat (mencegah loop manual ditulis ulang).

### 3. Boilerplate loading/error disalin 9 kali

Pola JSX persis sama:
```tsx
{isLoading && <p className="text-muted-foreground text-sm">Memuat...</p>}
{error && <p className="text-destructive text-sm">Gagal memuat: {(error as Error).message}</p>}
```
muncul verbatim di `account-group-list.tsx`, `account-list.tsx`,
`dashboard/current-month-summary-card.tsx`, `dashboard/mini-trend-chart.tsx`,
`dashboard/recent-transactions-card.tsx`, `dashboard/total-balance-card.tsx`,
`reports/account-balance-chart.tsx`, `reports/category-breakdown-chart.tsx`,
`reports/monthly-summary-chart.tsx`, `transactions/list/list-card-content.tsx`.

Kemungkinan arah: komponen `<QueryState query={result}>{(data) => ...}</QueryState>`
(render-prop) yang menangani `isLoading`/`error`/render data dalam satu
tempat, dipakai lintas semua card/list yang mengonsumsi hasil `useQuery`.

### 4. Invalidasi query key antar-fitur masih manual, rawan lupa

Tiap fitur ekspor `xQueryKey` sendiri (`categoriesQueryKey`,
`accountsQueryKey`, dst — 10+ file). Cross-feature invalidation dilakukan
dengan cara manual import key fitur lain: `transactions/form/use-create-transaction.ts`
mengimpor `accountsQueryKey` karena transaksi memengaruhi saldo akun;
`data-import/use-import-money-manager.ts` invalidate 4 key sekaligus secara
manual.

Tidak ada "peta ketergantungan" terpusat (mis. "mengubah transactions
otomatis invalidate accounts") — risiko sama seperti alasan
`sort-pagination-scalable.md` dibuat: developer baru gampang lupa
invalidate key yang terkait saat menambah fitur yang menyentuh saldo.

Kemungkinan arah: helper kecil semacam `registerDependentKeys(sourceKey,
[...dependentKeys])`, atau minimal dokumentasi terpusat (bukan solusi
kode) yang mendaftar hubungan antar query key supaya tidak perlu diingat
dari kepala.

### 5. Beberapa chart masih pakai `Intl` mentah, bukan `lib/format.ts`

`formatRupiah`/`formatDateTime` di `src/lib/format.ts` sudah dipakai
konsisten di ~13 tempat. Tapi `reports/account-balance-chart.tsx` dan
`reports/monthly-summary-chart.tsx` masih memanggil
`Intl.NumberFormat("id-ID", ...)`/`Intl.DateTimeFormat("id-ID", ...)`
langsung — kemungkinan karena butuh format khusus untuk sumbu chart
(compact number, dst) yang belum ada variannya di `lib/format.ts`.

Kandidat paling lemah/rendah prioritas — sekadar rapi-rapi, bukan mencegah
bug. Kalau dikerjakan: tambahkan varian compact (mis.
`formatNumberCompact` yang sudah ada, cek apakah sudah cukup) ke
`lib/format.ts` daripada inline `Intl` call di komponen chart.

## Catatan

Urutan di atas berdasarkan dampak (risiko data loss > duplikasi kode >
kerapian kosmetik). Poin 1 (delete confirmation) sudah dieksekusi karena
levelnya bug korektnes, bukan sekadar preferensi arsitektur — sisanya
murni soal maintainability jangka panjang, dikerjakan sesuai kebutuhan
nyata saat menyentuh area itu lagi (bukan refactor besar sekaligus).

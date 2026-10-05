# Fix shortcut `/debts` tidak sync `transactions` + fix gap kontak `resolveContactId`

Lanjutan dari
[2026-10-05-verifikasi-fix-debts-duplikat-dan-gap-kontak.md](2026-10-05-verifikasi-fix-debts-duplikat-dan-gap-kontak.md):
2 pekerjaan terpisah dikerjakan dan diverifikasi manual via `tauri dev`
+ `wrangler dev` (D1 lokal, bukan production) sesi ini — implementasi
[`docs/todos/done/fix-debts-shortcut-tidak-tersync.md`](../todos/done/fix-debts-shortcut-tidak-tersync.md)
(rencana sudah ada dari sesi sebelumnya, dipindah ke `done/` sesi ini
setelah semua checklist lokal selesai), PLUS fix gap #1 kontak
(ditemukan ulang secara tidak sengaja di tengah verifikasi, bukan
direncanakan di awal sesi).

## 1. Fix shortcut `/debts` tidak push `transactions` — BERHASIL

Implementasi sesuai rencana: `use-create-debt.ts` (mode `direct` +
`transfer`) dan `use-pay-debt.ts` (3 cabang yang punya `transactionId`)
ditambahkan `void pushOnWrite("transactions", transactionId)` sejajar
push `debts`/`debt_payments` yang sudah ada. Worker tidak diubah sama
sekali (`POST /transactions` sudah generik, `validateCategoryExists`
dikonfirmasi aman menerima `categoryId: null`).

Verifikasi manual di D1 lokal (`wrangler dev`), 4 dari 5 jalur dicoba:

- Mode `direct` (buat piutang baru, tanpa transfer kas) — **berhasil**,
  `transactions` (type expense/income, `category_id: NULL`) + `debts`
  masuk D1.
- Mode `transfer` (buat piutang baru, via transfer kas↔debt) —
  **berhasil**, `transactions` (type transfer) + `debts` masuk D1.
- Bayar — cabang `cash` + `account_id` (transfer debt→kas) —
  **berhasil**.
- Bayar — cabang `non_cash` + `account_id` (transaksi penutup
  langsung) — **berhasil**, `debts.status` ikut terupdate `'paid'`.
- Bayar — cabang `cash` TANPA `account_id` (khusus data sync
  Retailku) — **dilewati**, tidak ada data semacam itu di DB lokal
  utk dicoba.

### Race FK `debts/push` vs `transactions` — gejala lama, BUKAN regresi baru

Di SETIAP percobaan di atas, muncul pola log yang sama: `POST
/debts/push` (atau `/debts/payments/push`) gagal duluan dgn
`500 FOREIGN KEY constraint failed` karena `pushOnWrite("transactions",
...)` dan `pushOnWrite("debts"/"debt_payments", ...)` dipanggil `void`
(fire-and-forget, tanpa urutan await) dari `mutationFn` yang sama —
kadang request `debts` sampai ke Worker LEBIH DULU sebelum
`transactions` ter-commit.

**Ini bukan bug baru** — persis gejala yang sudah dicatat di gap #8
dokumen dogfooding 2026-10-05 ("push `transactions` dan `debts` race").
Self-healing: `500` (beda dari `422`) tetap masuk antrian retry
(`push-on-write.ts`), jadi begitu window Tauri di-reload (memicu
`retryPendingPushes()` via `useAutoPullSync`), baris yang gagal
tersusul otomatis. Dikonfirmasi lewat query D1 ulang setelah reload —
semua baris yang sempat gagal 500 akhirnya masuk.

## 2. Fix gap #1 kontak: `resolveContactId` tidak push kontak baru — BERHASIL

Ditemukan ulang secara tidak sengaja: saat mencoba skenario "kontak
baru" di form `/debts` (bukan bagian rencana awal sesi ini), nama
kontak baru langsung memicu `POST /transactions 422 Unprocessable
Entity` — reproduksi persis root cause yang sudah didiagnosis di
dogfooding 2026-10-05 gap #1, belum pernah diperbaiki di kode sampai
sesi ini.

Fix:
[`resolve-contact.ts`](../../apps/desktop/src/shared/contacts/resolve-contact.ts) —
tambah `void pushOnWrite("contacts", id)` setelah INSERT lokal kontak
baru, pola yang sama persis dgn `use-create-contact.ts` yang sudah
benar sejak awal. Scope fix ini otomatis menutup gap utk SEMUA caller
`resolveContactId` (4 titik: `use-create-debt.ts`,
`use-create-transaction.ts`, `use-update-transaction.ts`,
`insert-ar-ap-transaction.ts` jalur Retailku), bukan cuma shortcut
`/debts`.

Type-check + test suite desktop (172/172) lolos setelah perubahan.

Verifikasi manual 2x skenario berbeda, D1 lokal:

1. Kontak baru via shortcut `/debts` ("Wowo") — `POST /contacts 201` →
   `POST /transactions 201` → `POST /debts/push 201`, berurutan sukses
   TANPA race FK sama sekali (push kontak terjadi paling awal di
   `mutationFn`, sebelum insert `transactions`/`debts`, jadi secara
   alami menghindari race yang dialami poin 1 di atas).
2. Kontak baru via form Transaksi utama ("Budi Testing") — sama,
   `contacts` → `transactions` sukses berurutan, dikonfirmasi lewat
   JOIN D1 (`contact_id` transaksi merujuk id kontak yang baru
   ter-push).

### Catatan proses: percobaan pertama gagal karena data sisa, BUKAN fix salah

Percobaan pertama reload gagal (log tetap menunjukkan `/debts/push`
race FK, tanpa `POST /contacts` sama sekali) — investigasi menemukan
kontak "Wowo" SUDAH ada di `finance.dev.db` lokal dari percobaan
SEBELUM fix diterapkan (`resolveContactId` masuk cabang "kontak sudah
ada", skip insert+push). Setelah kontak+transaksi+debt sisa itu
di-hard-delete (dicek dulu tidak ada `debt_payments` terkait), retest
dgn nama yang sama ("Wowo", sekarang benar-benar baru lagi) langsung
sukses.

## Pembersihan data tambahan: dedup kontak "Wahyu" sisa bug lama

Saat mencoba kontak baru, ditemukan dropdown "Nama Kontak" masih
menampilkan "Wahyu" berulang (gap #2 dari dogfooding 2026-10-05,
combobox key collision — BELUM diperbaiki sesi ini). Investigasi
mengungkap kontak "Wahyu" duplikat (2 baris, id berbeda, sisa rantai
bug gap #1 SEBELUM fix) masih ada di **2 tempat terpisah**:

- **D1 Worker lokal** (`wrangler dev`): id lama dipakai 2 `debts` + 1
  `transactions`; id baru 0 pemakaian. Keduanya di-hard-delete
  (`contacts`, `transactions`, `debts` terkait — dicek dulu tidak ada
  `debt_payments`).
- **`finance.dev.db` desktop lokal**: SEBALIKNYA — id lama 0
  pemakaian, id baru dipakai 1 `transactions` + 1 `debts`. Arah
  pemakaian terbalik antara D1 dan lokal (bukti nyata 2 sisi sempat
  diverge krn gap #1 lama). Backup dibuat
  (`finance.dev.db.bak_20261006_035651_before-hard-delete-wahyu-dupe`)
  sebelum keduanya di-hard-delete juga.

Setelah dedup, dropdown "Wahyu" tampil normal (1 entri) — tapi ini
WORKAROUND DATA, bukan fix kode. `contact-field.tsx` masih pakai
`contact.name` sbg key (gap #2), berpotensi berulang kalau sumber lain
(MCP/Retailku) membuat kontak nama sama lagi SEBELUM nama itu
di-resolve lokal.

**Pelajaran prosedural**: sempat query `finance.db` (bukan
`finance.dev.db`) di awal investigasi — salah file, karena `tauri dev`
SELALU pakai `finance.dev.db` (lihat
[`checking-dev-database.md`](../../apps/desktop/docs/rules/checking-dev-database.md)).
Dikoreksi user. Query berikutnya diulang dgn prosedur yang benar (copy
`.db`+`-wal`+`-shm` ke scratchpad dulu, baru query salinan) — hasil
akhirnya SAMA (bukan basi), tapi prosedurnya tetap wajib diikuti utk
menghindari risiko baca data stale dari WAL yang belum di-checkpoint.

## Status gap kontak (dari dogfooding 2026-10-05) setelah sesi ini

- Gap #1 (`resolveContactId` tidak push) — **FIXED** kode-nya sesi
  ini (bukan cuma workaround lagi).
- Gap #2 (combobox key collision) — BELUM diperbaiki. Dampaknya
  kemungkinan BERKURANG sekarang krn akar penyebab paling umum (kontak
  duplikat akibat gap #1) sudah tertutup, tapi root cause UI-nya
  sendiri (pakai `name` sbg key, bukan `id`) masih ada.
- Gap #3 (422 tidak retry) — BELUM diperbaiki. Relevan lagi kalau ada
  gap sync lain serupa gap #1 di masa depan (dependency lain yang
  belum ter-push saat entity yang bergantung dicoba push).

## Yang BELUM dilakukan (di luar scope sesi ini)

- Jalur "Bayar — cash TANPA account_id" (data sync Retailku) belum
  dicoba manual — tidak ada data uji di DB lokal.
- Gap #2 dan #3 kontak masih terbuka, belum ada dokumen rencana
  tersendiri (masih tercatat di dogfooding doc saja).
- Belum deploy ke production / belum dicoba dogfooding production
  sungguhan — sesi ini seluruhnya `wrangler dev` + `tauri dev` lokal.

# Fix: Desktop push `debts`/`debt_payments` sendiri (source-based ownership)

Index lintas-app:
[`docs/todos/done/fix-debts-duplikasi-sync.md`](../../../../../docs/todos/done/fix-debts-duplikasi-sync.md).
Detail Worker:
[`apps/worker/docs/todos/done/fix-debts-duplikasi-sync.md`](../../../../worker/docs/todos/done/fix-debts-duplikasi-sync.md).

## Status & TODO saat ini (ringkas)

- [x] Migrasi SQL baru (`0034_cloud_sync_queue_debts.sql`): rebuild
      `cloud_sync_queue` dgn CHECK constraint `table_name` baru
      (tambah `'debts'`, `'debt_payments'`) — pola rename → create baru
      → copy data → drop old, sama 0009/0022/0027. Tabel ini TIDAK
      direferensikan FK tabel lain, jadi cukup 1 tabel (tidak serumit
      rantai dependency 0027).
- [x] Didaftarkan di `migrations.rs` sbg versi 34.
- [x] Tambah `"debts" | "debt_payments"` ke union type `QueueableTable`
      (`push-queue.ts`).
- [x] Tambah case `"debts"`/`"debt_payments"` di `pushRowPayload`
      (`push-row.ts`) — termasuk `source`/`sourceRef` apa adanya (TIDAK
      di-drop). Case `"debts"` SKIP push (return null) kalau
      `transaction_id` NULL (endpoint Worker mewajibkan `transactionId`)
      — baris begini HANYA dari gap terpisah (#3/#4 di bawah).
- [x] Tambah `pushDebt`/`pushDebtPayment` di `worker-client.ts`,
      panggil `POST /debts/push` / `POST /debts/payments/push` (path
      final, BUKAN `/debt-payments/push` spt draft awal — disesuaikan
      krn tidak ada router `debt-payments` terpisah, semua lewat
      `debtsRouter`).
- [x] `applyDebtTransaction`/`applyDebtTransactionEdit`/`settleDebtsFifo`
      lokal (`apps/desktop/src/shared/debts/apply-debt-transaction.ts`)
      DIUBAH return `TouchedDebtRows` (`{ debtIds, debtPaymentIds,
      deletedDebtIds, deletedDebtPaymentIds }`, array krn FIFO
      settlement bisa sentuh beberapa baris sekaligus), bukan lagi
      `void`. 2 field `deleted*` ditambahkan belakangan (lihat gap di
      bawah) — id baris yg di-HARD-DELETE lokal sbg bagian RECREATE
      (edit field berbahaya), WAJIB di-`pushDeleteOnWrite`.
- [x] Tambah pemanggilan `pushOnWrite("debts", id)` /
      `pushOnWrite("debt_payments", id)` di SEMUA 5 titik (daftar di
      bawah) — push TERPISAH dari `pushOnWrite("transactions", id)`.
      Titik #3/#4 (shortcut `/debts`) SENGAJA HANYA push `debts`/
      `debt_payments`, TIDAK ikut push `transactions` (gap terpisah,
      luar scope — lihat catatan di bawah). Titik #5 (edit-payment) jg
      TIDAK push `transactions` (gap existing BERBEDA, tidak disebut di
      scope fix ini, tidak diperlebar).
- [x] **Gap ditemukan & ditutup (2026-10-05, test manual)**: titik #2
      (`use-update-transaction.ts`) dan #5 (`use-edit-payment.ts`) —
      SATU-SATUNYA 2 titik yg memanggil `applyDebtTransactionEdit` —
      juga panggil `pushDeleteOnWrite("debts"/"debt_payments", id, {})`
      utk tiap id di `touchedDebtRows.deletedDebtIds`/
      `deletedDebtPaymentIds`. Tanpa ini, RECREATE (edit field
      berbahaya) bikin baris LAMA menumpuk di D1 selamanya — Worker
      tidak pernah tahu id lama harus dihapus kalau desktop cuma push
      baris baru. `DeleteCloudPayload`/`DELETE_PATH` di `worker-client.ts`
      ditambah entry `debts: "/debts/push"` dan
      `debt_payments: "/debts/payments/push"` (`DELETE_PATH[table]/:id`
      -> `DELETE /debts/push/:id`, cocok endpoint baru Worker). Detail
      endpoint: dokumen Worker, bagian "Gap ditemukan saat test manual".
- [x] Test migrasi (`migrations.rs` test suite) tetap lolos (3/3 test,
      termasuk `semua_migration_berhasil_dijalankan_dari_nol` dgn
      migrasi 0034 baru). Test suite TS (`vitest run`, 172/172 test
      termasuk `apply-debt-transaction.test.ts`) jg tetap lolos setelah
      gap DELETE ditutup.
- [x] Verifikasi manual via `tauri dev` + `wrangler dev` SELESAI
      (bukan simulasi, dgn query `wrangler d1 execute --local`
      langsung): transfer cash→debt baru -> 1 baris `debts` (bukan 2).
      Edit nominal 2x berturut-turut -> precheck lolos, recreate
      delete+insert jalan benar, `DELETE /debts/push/:id` 200 OK, net
      pertambahan baris AKTIF (`deleted_at IS NULL`) per edit = 0.
      Ketemu & ditutup gap DELETE di tengah proses verifikasi ini
      (lihat poin di atas) — BUKAN lolos dari percobaan pertama.

## Kenapa ini — ringkas (detail lengkap di dogfooding doc + index root)

Desktop sudah SELALU py jalur tulis lokal sendiri utk `debts`/
`debt_payments` (`apply-debt-transaction.ts`), independen dari
keputusan lama "Worker satu-satunya penulis D1". Karena jalur lokal
ini tidak pernah ter-push (tabel tidak ada di `cloud_sync_queue`), dan
Worker ALSO men-derive baris sendiri dari transaksi yang sama,
hasilnya 2 baris per transaksi. Fix: desktop PUSH baris yg SUDAH ia
buat (id dipakai apa adanya oleh Worker), Worker BERHENTI men-derive
utk transaksi `syncSource==='pc'` (detail di dokumen Worker).

## Semua titik yang menulis `debts`/`debt_payments` lokal (WAJIB dapat push)

Hasil grep lengkap `applyDebtTransaction`/`applyDebtTransactionEdit`
+ insert manual langsung:

1. [`use-create-transaction.ts:101`](../../../src/features/transactions/form/add-edit/hooks/use-create-transaction.ts) —
   `applyDebtTransaction`, create transaksi normal (form utama).
2. [`use-update-transaction.ts:109`](../../../src/features/transactions/form/add-edit/hooks/use-update-transaction.ts) —
   `applyDebtTransactionEdit`, edit transaksi normal.
3. [`new-debt-form/use-create-debt.ts:115`](../../../src/shared/debts/new-debt-form/use-create-debt.ts) —
   `applyDebtTransaction`, mode `record_mode==='transfer'`. Mode
   `'direct'` (baris 81-95) insert `debts` MANUAL langsung (arah tidak
   ambigu, bukan lewat `applyDebtTransaction`) — tetap butuh push juga.
4. [`pay-debt-form/use-pay-debt.ts:174`](../../../src/shared/debts/pay-debt-form/use-pay-debt.ts) —
   `applyDebtTransaction` dgn `debtAction:"settlement"` (mode cash +
   `debt.account_id` terisi). Cabang mode `non_cash` & mode cash dgn
   `account_id` NULL (baris 90-161) insert `debt_payments` LANGSUNG —
   juga butuh push.
5. [`edit-payment-form/use-edit-payment.ts:68`](../../../src/shared/debts/edit-payment-form/use-edit-payment.ts) —
   `applyDebtTransactionEdit`, edit cicilan existing.

**Catatan terpisah (BUKAN scope fix ini)**: titik #3 dan #4 SAAT ITU
juga tidak memanggil `pushOnWrite("transactions", ...)` sama sekali
(beda dari #1/#2) — transaksi dari shortcut `/debts` tidak ter-sync ke
Worker. Gap terpisah ini SELESAI, lihat
[`docs/todos/done/fix-debts-shortcut-tidak-tersync.md`](../../../../../docs/todos/done/fix-debts-shortcut-tidak-tersync.md).

## Skema kolom (acuan implementasi `push-row.ts`/`worker-client.ts`)

`debts` desktop: `id, type, contact_id, amount, account_id,
transaction_id, status, note, date, created_at, source, source_ref,
updated_at, deleted_at, sync_source`. `debt_payments`: `id, debt_id,
amount, account_id, transaction_id, note, date, created_at, source,
source_ref, updated_at, deleted_at, sync_source`. Struktur D1 identik
nama kolom — mapping push 1:1 camelCase tanpa transformasi aneh (lihat
dokumen Worker utk skema D1 lengkap).

## Yang TIDAK berubah

- `pull-sync.ts` (`upsertDebt`/`upsertDebtPayment`) — TIDAK perlu
  diubah kodenya. Begitu Worker berhenti men-derive `debts` utk
  transaksi PC, response `/sync` otomatis tidak lagi membawa balik
  baris duplikat — behavior berubah tanpa sentuh kode pull.
- `cloud_sync_queue` retry/flush logic (`push-queue.ts`) — sudah
  generik per nama tabel string, tidak perlu logic khusus baru,
  cukup tambah literal type + case baru di `pushRowPayload`.
  `DeletableTable` (dipakai `enqueueDeletePush`/retry) OTOMATIS
  mencakup `debts`/`debt_payments` krn diturunkan dari
  `DeleteCloudPayload["table"]` — tidak perlu sentuh `push-queue.ts`
  sama sekali utk gap DELETE yg ditutup belakangan (lihat checklist).

# Fix: Desktop push `debts`/`debt_payments` sendiri (source-based ownership)

Index lintas-app:
[`docs/todos/plan/fix-debts-duplikasi-sync.md`](../../../../docs/todos/plan/fix-debts-duplikasi-sync.md).
Detail Worker:
[`apps/worker/docs/todos/plan/fix-debts-duplikasi-sync.md`](../../../worker/docs/todos/plan/fix-debts-duplikasi-sync.md).

## Status & TODO saat ini (ringkas)

- [ ] Migrasi SQL baru: ubah CHECK constraint `cloud_sync_queue.table_name`
      supaya include `'debts'` dan `'debt_payments'` — SQLite tidak
      support `ALTER ... DROP CONSTRAINT`, ikuti pola rebuild tabel yang
      sudah dipakai migrasi 0009/0022/0027 (rename → create baru dgn
      CHECK baru → copy data → drop old).
- [ ] Daftarkan migrasi baru di `migrations.rs` (versi berikutnya
      setelah 33) — WAJIB manual, tidak auto-discovery (lihat
      [[feedback_migration_rs_registration]] di memory).
- [ ] Tambah `"debts" | "debt_payments"` ke union type `QueueableTable`
      (`push-queue.ts`).
- [ ] Tambah case `"debts"`/`"debt_payments"` di `pushRowPayload`
      (`push-row.ts`) — pola SELECT by id → map snake_case ke
      camelCase, PERSIS pola case `"transactions"` yang sudah ada
      (termasuk kirim `source`/`sourceRef` apa adanya, JANGAN
      di-drop, supaya tidak merusak provenance retailku).
- [ ] Tambah `pushDebt`/`pushDebtPayment` di `worker-client.ts`,
      panggil endpoint baru Worker (`POST /debts/push`,
      `POST /debt-payments/push`) — lihat detail Worker.
- [ ] `applyDebtTransaction`/`applyDebtTransactionEdit` lokal
      (`apps/desktop/src/shared/debts/apply-debt-transaction.ts`)
      DIUBAH supaya RETURN id baris `debts`/`debt_payments` yang
      disentuh (saat ini `void`) — dibutuhkan caller utk tahu id mana
      yang perlu di-`pushOnWrite`.
- [ ] Tambah pemanggilan `pushOnWrite("debts", id)` /
      `pushOnWrite("debt_payments", id)` di SEMUA 5 titik yang menulis
      `debts`/`debt_payments` lokal (daftar lengkap di bawah) — push
      TERPISAH dari `pushOnWrite("transactions", id)` yang sudah ada
      (1 fungsi push = 1 row = 1 tabel, tidak digabung).
- [ ] Verifikasi test migrasi (`migrations.rs` test suite, baris
      207-332) tetap lolos dgn CHECK constraint baru.
- [ ] Verifikasi manual via `tauri dev` + cek `finance.dev.db` (ikuti
      [`checking-dev-database.md`](../../rules/checking-dev-database.md))
      — pastikan transfer cash→debt baru TIDAK lagi menghasilkan 2
      baris `debts` setelah pull berikutnya.

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

**Catatan terpisah (BUKAN scope fix ini)**: titik #3 dan #4 SAAT INI
juga tidak memanggil `pushOnWrite("transactions", ...)` sama sekali
(beda dari #1/#2) — transaksi dari shortcut `/debts` tidak ter-sync ke
Worker. Ini gap terpisah, dicatat di index root, JANGAN digabung
perbaikannya ke sini supaya scope tetap fokus ke soal duplikasi.

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

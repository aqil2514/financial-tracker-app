# `update-transaction`

Mirror struktur `use-create-transaction/create-transaction/` untuk
jalur UPDATE — `updateTransaction(transaction, values, status)`
(`index.ts`) dipanggil sebagai `mutationFn`. Resolve `contact_name` →
`contactId`, lalu cabang per `values.type`:

- `"income"` → `updateIncomeTransaction` (`income.ts`)
- `"expense"` → `updateExpenseTransaction` (`expense.ts`)
- `"transfer"` → `updateTransferTransaction` (`transfer/index.ts`)

`income.ts`/`expense.ts` murni delegasi ke helper bersama
(`../../helper`): `updateTransactionToDb` lalu `applyLabelsAndPush` —
simetris dengan `insertTransactionToDb` di sisi create.

## Beda dari `create-transaction`: `status` & `dangerousFieldsChanged`

`updateTransaction` terima parameter ketiga, `status`
(`TransactionDebtStatus`, dari `useTransactionDebtStatus`) — SATU-
SATUNYA nilai yang TIDAK bisa dihitung sendiri di `update-transaction/`
karena butuh React Query hook (mutationFn murni tidak boleh
memanggilnya). Caller (hook React di level `use-update-transaction/`)
WAJIB sudah resolve ini SEBELUM memanggil `updateTransaction`.

`dangerousFieldsChanged` (boolean, hasil banding field lama
`transaction` vs `values`+`contactId` baru) SEBALIKNYA dihitung DI
DALAM `index.ts` (setelah `resolveContactId`), BUKAN diterima dari
luar — `contactId` yang dipakai banding harus sama persis dengan yang
dipakai mutasi sesudahnya, menghitungnya di sini mencegah
`resolveContactId` double-query (sekali di hook, sekali lagi di sini
kalau logicnya dipisah). Keduanya cuma dipakai `transfer/debt.ts`
(lewat `applyDebtTransactionEdit`) — income/expense/cash-transfer/
investment-transfer tidak pernah menyentuhnya.

## `transfer/` — percabangan per pasangan jenis akun

Sama persis pola create (`classifyAccountPair` di `transfer/index.ts`
menentukan routing ke `cash.ts`/`debt.ts`/`investment.ts`):

- **`cash.ts`** (`updateCashToCashTransfer`) — `updateTransactionToDb`
  + `applyLabelsAndPush` saja, TIDAK menyentuh
  `applyDebtTransactionEdit`/`applyInvestmentTransactionEdit` sama
  sekali (berbeda dari `use-update-transaction/index.ts` versi lama,
  yang memanggil keduanya untuk SEMUA transfer dan mengandalkan
  masing-masing fungsi itu no-op sendiri kalau bukan pair yang
  relevan — di sini branching-nya eksplisit di caller, konsisten
  dengan pola create).
- **`debt.ts`** (`updateDebtTransfer`) — `updateTransactionToDb`, lalu
  `applyDebtTransactionEdit` (butuh `status`/`dangerousFieldsChanged`
  dari atas), lalu `applyLabelsAndPush`, lalu push manual baris
  `debts`/`debt_payments` yang tersentuh (TERMASUK push-delete untuk
  id LAMA yang kena recreate — lihat komentar `TouchedDebtRows` di
  `apply-debt-transaction.ts`).
- **`investment.ts`** (`updateInvestmentTransfer`) — mirror
  `createInvestmentTransfer`, pakai versi Edit dari helper shared
  (`applySellInvestmentTransactionEdit`/`applyInvestmentTransactionEdit`).
  BEDA dari `debt.ts`: TIDAK butuh `status`/`dangerousFieldsChanged`
  dari luar — kedua fungsi Edit ini mendeteksi baris lama sendiri lewat
  query `getTransaction...Row(db, transactionId)` di dalamnya, bukan
  lewat hook React. Push tambahan dibanding create: `pushDeleteOnWrite`
  untuk `deletedInvestmentPurchaseIds`/`deletedInvestmentSaleIds` (id
  lama yang kena recreate, sama alasan dengan `debt.ts`).

## Status

- `income.ts`, `expense.ts`, `transfer/{cash,debt,investment}.ts` —
  semua sudah diisi logic nyata, BELUM pernah dirender/diuji di
  `tauri dev`.
- `updateTransaction` BELUM dipanggil dari mana pun — hook React
  (`use-update-transaction/index.ts`, versi lama, `useEntityForm`)
  masih dipakai apa adanya, versi baru ini belum di-wire.
- Write-off investasi (income/expense langsung ke akun investment,
  TANPA transfer_account_id) BELUM tercakup di sini — di luar scope
  struktur per-pair ini, lihat `docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md`.

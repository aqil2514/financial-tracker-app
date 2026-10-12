# `entities/debts`

Fungsi baca yang dimiliki entitas `debts`, dihitung dari `SyncSnapshot` (hasil `/sync` Worker), bukan query SQL terpisah.

## `summarize-debts.ts`

`summarizeDebts` — total sisa (`ongoing`) dan jumlah baris piutang/utang yang masih berstatus `ongoing`, dikurangi akumulasi `debtPayments` per baris debt.

## `list-debt-details.ts`

`listDebtDetails` — menutup gap `cloud-sync.md` Tahap 8: tanpa ini, Claude tidak punya cara menemukan `transactionId` satu baris cicilan (`debt_payments`) tertentu, padahal `update_transaction`/`delete_transaction` yang SUDAH ADA bisa langsung dipakai untuk edit/hapus cicilan (Worker PATCH/DELETE `/transactions/:id` reuse `applyDebtTransactionEdit`/`detachDebtForDeletedTransaction`, sama seperti `use-edit-payment.ts` desktop). Gap-nya murni di sisi BACA, bukan di Worker.

## `list-contact-history.ts`

`listContactHistory` — transaksi + detail utang/piutang (lewat `listDebtDetails`) untuk satu kontak.

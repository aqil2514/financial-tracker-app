# `entities/accounts`

Fungsi baca yang dimiliki entitas `accounts`, dihitung dari `SyncSnapshot` (hasil `/sync` Worker), bukan query SQL terpisah.

## `compute-account-balance.ts`

`computeAccountBalance` — formula SAMA PERSIS dengan `getAccountBalance()` di `apps/worker/src/modules/accounts/service.ts`: `initial_balance + income - expense - transfer keluar + transfer masuk`, cuma baris transaksi hidup (`deletedAt` null) yang dihitung.

## `list-alive-accounts.ts`

`listAliveAccounts` — filter akun yang belum soft-deleted.

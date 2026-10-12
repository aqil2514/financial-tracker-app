# `entities/transactions`

Fungsi baca yang dimiliki entitas `transactions`, dihitung dari `SyncSnapshot` (hasil `/sync` Worker), bukan query SQL terpisah.

## `list-transactions.ts`

`listTransactions` — filter + sort transaksi hidup. Dua catatan non-obvious di opsinya:

- `transferDirection` hanya berlaku kalau `accountId` diisi. Tanpa opsi ini, `accountId` cocok di KEDUA sisi (sumber ATAU tujuan transfer), demi backward compatible. `"from"` → `accountId` WAJIB jadi akun sumber (bukan tujuan transfer); `"to"` → WAJIB jadi akun tujuan.
- `query` dicocokkan sebagai substring, case-insensitive, dicek di `note` DAN `description` — pengguna biasanya tidak tahu suatu kata disimpan di field mana.

## `summarize-cashflow.ts`

`summarizeCashflow` — cermin query SQL `use-cashflow-breakdown.ts` (desktop): breakdown kas masuk/keluar, TANPA join `debts`/`debt_payments` sama sekali. Mode `non_cash` memang tidak pernah punya baris `transactions`, dan semua pergerakan kas riil (termasuk pokok utang/piutang & pelunasannya) sudah tercatat sebagai baris `transactions` biasa (lihat migrasi `0033_backfill_direct_debt_transactions.sql` di desktop app) — jadi query `transactions` saja sudah cukup & akurat. Transfer antar akun EXCLUDE dari kas masuk/keluar (`type` cuma `income`/`expense`).

Dua dimensi breakdown: `"account_group"` (default, join ke `accounts.groupId` → `accountGroups.name`) atau `"parent_category"` (kategori tanpa `parentId` dipakai namanya sendiri, kategori anak digabung ke nama induknya, transaksi tanpa kategori → "Tanpa Kategori") — cermin toggle yang sama di UI desktop.

## `compute-balance-trend.ts`

`computeBalanceTrend` — cermin strategi 2-fase `use-balance-trend.ts` (desktop): (1) saldo awal SEBELUM `from`, (2) net perubahan per titik granularitas DALAM rentang `from..to`, running sum digabung terakhir — BUKAN re-SUM per titik dari awal waktu (lihat "Catatan performa" di `apps/desktop/docs/todos/done/reports-page-redesign.md`).

Filter akun nonaktif: exclude SECARA DEFAULT (`accountIds` kosong) — begitu user pilih akun spesifik, filter `isActive` dilepas supaya pilihan eksplisit itu (termasuk akun nonaktif) tetap terhitung.

`bucketLabel` (helper lokal): format `date` YYYY-MM-DD, slice murni, cermin `strftime` SQLite di `use-balance-trend.ts` (desktop), KECUALI `"week"` yang butuh hitungan ISO-week manual (tidak ada `strftime %W` setara di TS tanpa lib date).

# `is-account-in-use.ts` / `use-account-is-used.ts`

Prinsip #3 `docs/concept/konsep-tipe-akun.md` ("tipe akun permanen
setelah dipakai") — "dipakai" = ada baris TIDAK terhapus di salah satu
dari 3 tabel finansial yang FK ke `accounts` (`transactions` via
`account_id` ATAU `transfer_account_id`, `debts`, `debt_payments`). Port
persis dari query yang sama di Worker (`isAccountInUse`,
`apps/worker/src/modules/accounts/service.ts`) — `retailku_sync_field_mapping`
SENGAJA tidak dihitung, itu konfigurasi mapping bukan histori transaksi.

`isAccountInUse` logic murni (bukan hook) supaya bisa dipanggil dari
`mutationFn` (`../hooks/use-update-account.ts`) maupun dibungkus
`useQuery` (`useAccountIsUsed`, dipakai `contents/detail/dialog/edit/`).

Ini safety net UX saja (field "Tipe Akun" dikunci read-only di form
begitu akun sudah dipakai) — Worker tetap jadi penjaga akhir untuk SEMUA
jalur tulis (push PC ini juga, MCP, dst).

`features/investment-detail/` punya versi sendiri (bukan reuse dari
sini) karena dipakai lintas fitur di luar konteks `contents/detail/`.

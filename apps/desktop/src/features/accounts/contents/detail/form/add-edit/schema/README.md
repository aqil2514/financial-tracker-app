# Schema form akun (add/edit)

Lokasi baru untuk `accountSchema` — hasil migrasi bertahap dari
`features/accounts/form/account.schema.ts` (lokasi lama itu masih ada dan
masih dipakai banyak importer lintas fitur: third-party, transactions,
categories, contacts, account-groups, dll lewat barrel
`@/features/accounts`). Migrasi importer-importer itu ke lokasi baru ini
dilakukan perlahan, satu per satu, bukan sekaligus.

## Field

- `unit_label` dan `current_market_value` hanya relevan saat
  `account_type === 'investment'` — disimpan di tabel terpisah
  `investment_accounts` (1:1 dengan `accounts`), lihat
  `docs/concept/konsep-investasi.md`. `current_market_value` adalah nilai
  pasar TOTAL instrumen saat ini, diisi manual langsung oleh user (BUKAN
  dihitung dari harga per unit × total unit — keputusan 2026-10-06, lihat
  `account-type-investment.md`: harga per unit tetap ada tapi turun ke
  level `investment_purchases` sebagai snapshot historis per-lot, bukan
  sumber hitung nilai pasar lagi).
- `label_names` — nama label (scope `'account'`, BUKAN id), cuma relevan
  saat `account_type === 'investment'` (jenis instrumen, mis.
  RDPU/Saham), lihat `shared/labels/label-field.tsx`.

## Validasi silang (`superRefine`)

- Tipe `investment` wajib mengisi `unit_label` dan `current_market_value`.
- Tipe `third_party` tidak boleh punya `initial_balance` selain 0 — setiap
  rupiah di akun ini harus bisa ditelusuri ke kontak tertentu lewat baris
  `third_party_funds` (income/expense), bukan "uang misterius" tanpa
  pemilik yang lahir dari `initial_balance`. Lihat
  `docs/concept/konsep-dana-pihak-ketiga.md`.

## `values.ts`

- `defaultAccountValues()` — nilai awal untuk dialog create.
- `accountValuesFromEntity(account, extra?)` — mapping entity `Account`
  (dari `@/lib/db`) ke `AccountFormValues` untuk dialog edit. `extra`
  dipisah dari `account` karena `unit_label`/`current_market_value`
  (tabel `investment_accounts`) dan `label_names` datang dari query
  terpisah (`useInvestmentAccount`, `useAccountLabels`) yang async — lihat
  `features/accounts/form/use-update-account.ts` untuk pola effect yang
  push ulang nilai itu begitu query-nya selesai, tanpa `form.reset()`
  penuh (supaya tidak menimpa field lain yang sudah diubah user).

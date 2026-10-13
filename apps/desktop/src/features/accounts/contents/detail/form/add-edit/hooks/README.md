# Hooks form akun (add/edit)

Lokasi baru untuk hook mutation form akun — hasil migrasi bertahap dari
`features/accounts/form/use-create-account.ts` dan `use-update-account.ts`
(lokasi lama masih dipakai importer lain lintas fitur, migrasi dilakukan
satu per satu). Beda dari versi lama: hook di sini TIDAK lagi membuat
`form` sendiri (tidak pakai `useEntityForm`) — cukup `useDbMutation`,
expose `{ onSubmit, isPending }` saja. Pembuatan `form` + auto-reset saat
dialog dibuka ulang jadi tanggung jawab `AccountForm`/`BaseForm` (lihat
`components/index.tsx` dan `@/components/forms/base-form.tsx`).

## `use-create-account.ts`

- `onCreated` — dipanggil dengan id akun yang baru dibuat, dipakai caller
  (mis. combobox akun di form transaksi) untuk langsung memilih akun baru
  itu tanpa user perlu cari ulang, atau untuk menutup dialog.
- Urutan `pushOnWrite("accounts", id)` HARUS selesai (`await`) sebelum
  `pushOnWrite("investment_accounts", id)` dikirim — `investment_accounts`
  punya FK ke `accounts(id)` di sisi Worker. Kalau keduanya fire-and-forget
  paralel, request kedua bisa sampai ke Worker lebih dulu dan gagal
  `FOREIGN KEY constraint failed` (bug nyata ditemukan saat smoke test
  Tahap 5).
- `resolveLabelIds`/`applyAccountLabels` dipanggil apa pun
  `account_type`-nya — aman karena `label_names` pasti `[]` untuk tipe
  selain `investment` (field itu cuma dirender saat `account_type ===
  'investment'`, lihat `components/fields/field-investment.tsx`).

## `use-update-account.ts`

- Menerima entity `Account` penuh (bukan cuma id) — dipakai untuk guard
  `isAccountInUse` (safety net UX, lihat
  `features/accounts/form/is-account-in-use.ts` — Worker tetap penjaga
  akhir untuk SEMUA jalur tulis) dan untuk `WHERE id = ...` di mutation.
- `onUpdated` — dipanggil setelah mutation sukses (analog `onCreated`),
  dipakai caller untuk menutup dialog.
- `investment_accounts` di-upsert manual (query dulu, lalu INSERT atau
  UPDATE) — akun bisa baru BERGANTI ke tipe `investment` di edit ini
  (belum pernah punya baris `investment_accounts`), atau sudah
  `investment` sejak awal (sekadar update `unit_label`/harga).
- Data prefill `unit_label`/`current_market_value` (dari
  `investment_accounts`) dan `label_names` (dari `account_labels`) datang
  dari query terpisah (`useInvestmentAccount`, `useAccountLabels`) di
  level CALLER (dialog), bukan di hook ini — lihat
  `accountValuesFromEntity` di `../schema/values.ts`. Berkat auto-reset
  effect di `BaseForm`, begitu query-query itu selesai dan
  `defaultValues` berubah referensinya, form ikut ter-reset otomatis —
  tidak perlu lagi `useEffect` manual `form.setValue(...)` seperti versi
  lama.

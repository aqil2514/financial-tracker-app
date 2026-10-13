# Schema form transaksi

## Field

- `debt_action` — cuma relevan saat transfer dari akun `debt` ke akun
  `cash`: arah transfer semata ambigu (bisa pelunasan piutang ATAU utang
  baru), jadi user pilih eksplisit. Null di luar kasus itu.
- `settle_debt_ids` — piutang (`debts.id`, sebagai string) yang dipilih
  untuk dilunasi, cuma relevan saat `debt_action === 'settlement'`.
- `unit`, `price_per_unit` — jumlah unit & harga per unit saat pembelian,
  relevan hanya saat transfer tujuannya akun `investment` (lihat
  `use-transaction-investment-fields.ts`), null di luar kasus itu.
  SENGAJA tidak divalidasi terhadap `amount` (lihat
  `docs/concept/konsep-investasi.md` bagian "Unit dan harga per unit").
  OPSIONAL kalau `investment_status` `'pending'`, WAJIB kalau `'settled'`
  — divalidasi di `useTransactionInvestmentFields` (butuh tahu account
  type tujuan, tidak bisa murni di schema).
- `investment_status` — status baris `investment_purchases` yang akan
  dibuat/diupdate, cuma relevan saat transfer tujuannya akun `investment`,
  null di luar kasus itu. Lihat `docs/concept/konsep-investasi.md` bagian
  "Settlement tertunda".
- `label_names` — nama label (scope `'transaction_category'`, BUKAN id)
  yang dipilih dari combobox multi-select — resolusi ke id (termasuk
  create label baru) terjadi di `mutationFn` lewat `resolveLabelIds`.
  Boleh lebih dari satu label sekaligus (keputusan 2026-10-09), lihat
  `label-field.tsx`.

## `values.ts`

`defaultTransactionValues(overrides?)` — nilai default untuk dialog
create. Hanya untuk CREATE — mode edit (`use-update-transaction.ts`) tetap
membangun `defaultValues()`-nya sendiri di dalam hook karena bergantung
pada entity `transaction` yang sedang diedit + `contactName` yang
di-resolve terpisah + sinkronisasi label lewat `useEffect` tambahan
(race condition dengan query label, lihat komentar di hook itu) — terlalu
spesifik untuk dipindah ke sini.

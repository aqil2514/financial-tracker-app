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

- `defaultTransactionValues(overrides?)` — nilai default untuk dialog
  CREATE, semua field kosong/netral.
- `transactionValuesFromRow(transaction, extras)` — versi untuk prefill
  dialog EDIT (dipakai `base-form-migration/hooks/use-update-transaction/`).
  Fungsi MURNI — field yang tersedia sinkron dari `transaction`
  (`amount`/`account_id`/`note`/dst) dibaca langsung, tapi field yang
  butuh query async (`contactName` dari `useContacts`, `unit`/
  `pricePerUnit`/`investmentStatus` dari `useTransactionInvestmentPurchase`/
  `Sale`, `labelNames` dari `useTransactionLabels`) WAJIB sudah
  di-resolve oleh CALLER dan dioper lewat `extras` — fungsi ini sendiri
  tidak boleh memanggil hook apa pun (pola sama dengan mutationFn murni
  di `update-transaction/`).

  `debt_action`/`settle_debt_ids` selalu direset kosong (BUKAN
  direkonstruksi dari `debt_payments` lama) — lihat "Edit transaksi
  yang sudah py debts terkait" di `debt-receivable-tracking.md`.

  `use-update-transaction/index.ts` (versi LAMA, `useEntityForm`, masih
  aktif dipakai form) TIDAK memakai fungsi ini — `defaultValues()`-nya
  masih inline di dalam hook, termasuk sinkronisasi `label_names` lewat
  `useEffect` tambahan (race condition dengan query label, bug nyata
  2026-10-10, lihat komentar di hook itu) yang belum direplikasi di
  jalur `BaseForm` baru.

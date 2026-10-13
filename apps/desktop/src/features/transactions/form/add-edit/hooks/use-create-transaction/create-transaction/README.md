# `create-transaction`

`createTransaction(values)` (`index.ts`) — orkestrator utama, dipanggil
sebagai `mutationFn` dari `use-create-transaction` (`../index.ts`).
Resolve `contact_name` → `contactId`, lalu cabang per `values.type`:

- `"income"` → `createIncomeTransaction` (`income.ts`)
- `"expense"` → `createExpenseTransaction` (`expense.ts`)
- `"transfer"` → `createTransferTransaction` (`transfer/index.ts`)

`income.ts`/`expense.ts` murni delegasi ke helper bersama
(`../helper`): `insertTransactionToDb` lalu `applyLabelsAndPush`.
Keduanya SENGAJA tetap dua file terpisah walau isinya identik sekarang
— kalau nanti salah satu butuh percabangan berbeda, tidak perlu pecah
ulang strukturnya.

## `transfer/` — percabangan per pasangan jenis akun

`transfer/index.ts` adalah orkestrator KHUSUS transfer: deteksi
`account_type` sumber & tujuan lewat `getAccountType`, klasifikasikan
pasangannya lewat `classifyAccountPair`, lalu panggil salah satu:

- **`cash.ts`** (`createCashToCashTransfer`) — pasangan `cash-cash`
  (atau pasangan yang gagal diklasifikasi/`transferAccountId` kosong,
  fallback paling aman). Cuma INSERT + label, tidak menyentuh
  `debts`/`investment_purchases`/`investment_sales` sama sekali.
- **`debt.ts`** (`createDebtTransfer`) — pasangan `cash-debt`,
  `debt-cash`, `debt-debt`. INSERT, lalu `applyDebtTransaction` (fungsi
  shared yang MENDETEKSI SENDIRI pasangan akunnya lagi secara
  independen — deteksi di `transfer/index.ts` cuma dipakai untuk
  ROUTING ke file yang benar, bukan dioper sebagai hasil final ke
  fungsi shared).
- **`investment.ts`** (`createInvestmentTransfer`) — pasangan
  `cash-investment` (beli) dan `investment-cash` (jual). Satu-satunya
  kasus yang menghitung ulang `amount` SEBELUM insert (lihat bagian
  "Alur `createInvestmentTransfer`" di bawah).

Pasangan macam `cash-cash` dan hasil klasifikasi gagal (akun sudah
terhapus, atau kombinasi belum dikenal `classifyAccountPair`) SENGAJA
diarahkan ke jalur yang sama (`cash.ts`) — paling aman karena tidak
memicu efek samping apa pun ke tabel turunan.

## Alur `createInvestmentTransfer` (paling kompleks)

1. Deteksi arah investment SEBELUM insert — untuk arah jual
   (investment → cash), nominal yang di-INSERT ke `transactions.amount`
   BUKAN `values.amount` (field itu dikunci read-only di form, cuma
   preview) tapi `average_cost * unit`, pola PERSIS
   `use-create-investment-sale.ts`. Lihat
   `docs/concept/konsep-investasi.md` bagian "Efek ke
   accounts.balance".
2. Kalau arah jual: validasi oversell SEBELUM insert baris
   `transactions` — beda dari dialog "Jual Investasi" khusus
   (`use-create-investment-sale.ts`) yang membiarkan
   `InsufficientInvestmentUnitsError` terlempar SETELAH insert
   (meninggalkan baris `transactions` yatim kalau gagal). Fungsi ini
   bisa cek lebih awal karena sudah query account type duluan di atas.
3. INSERT baris `transactions` (leg utama).
4. Cabang investment: kalau arah jual → `applySellInvestmentTransaction`
   (unit/price_per_unit WAJIB diisi di titik ini — sudah divalidasi
   `useTransactionInvestmentFields.validateInvestmentFields` sebelum
   `mutationFn` dipanggil, aman non-null di sini; status SELALU
   dipaksa `"settled"` — form transaksi utama ini TIDAK pernah insert
   jual status `"pending"`, keputusan 2026-10-07, karena arsitekturnya
   selalu insert baris transaksi, kontradiktif dengan status pending
   yang justru tidak boleh insert transaksi sama sekali). Kalau bukan
   arah jual → `applyInvestmentTransaction` biasa.
5. `applyLabelsAndPush` — push leg utama ke cloud sync (`pushOnWrite`)
   + attach label, WAJIB DULUAN sebelum push baris turunan (langkah 6).
6. Push baris turunan (adjustment transaction, investment
   purchase/sale) — urutan DIJAGA KETAT setelah langkah 5: baris
   turunan ini semua punya FK ke `transactions(id)` — kalau push-nya
   race (bug nyata ditemukan Tahap 5 sebelum dipecah per file: push
   baris turunan sampai ke Worker LEBIH DULU dari leg utamanya),
   FOREIGN KEY constraint di sisi Worker gagal. `debt.ts` punya urutan
   yang sama persis (push `debts`/`debt_payments` setelah
   `applyLabelsAndPush`, bukan sebelum).
7. Return `transactionId`.

## Catatan TypeScript — kenapa fungsi kasus terima `TransactionFormOutput` polos

`TransactionFormOutput` (lihat `schema/schema.ts`) BUKAN discriminated
union per `type` — satu flat object dengan field `type: "income" |
"expense" | "transfer"`, field lain tidak ikut ber-union per varian.
Akibatnya `values.type === "income"` di caller TIDAK mempersempit
`values` jadi bentuk literal `& { type: "income" }` kalau dioper lewat
property object (`{ values }`) ke fungsi lain. Solusinya: fungsi kasus
terima `TransactionFormOutput` apa adanya, kontrak "hanya untuk income"
dijaga lewat penamaan fungsi (`createIncomeTransaction`), bukan lewat
tipe — begitu juga di dalam `debt.ts`/`investment.ts`, beberapa field
(`debt_action`, `settle_debt_ids`) masih perlu guard inline
`values.type === "transfer" ? ... : ...` walau secara runtime fungsi
itu memang cuma pernah dipanggil untuk transfer.

# Hooks form transaksi

## `use-transaction-form.ts`

Semua logic non-JSX di balik `TransactionForm` — watch field dari
react-hook-form, turunan state (akun sumber/tujuan bertipe debt), dan
kedua hook pendukung (debt fields, account/category options) — supaya
`form.tsx` sendiri tinggal render.

### Aturan UX akun `debt`

Akun `debt` cuma bisa disentuh lewat transfer (lihat
`apply-debt-transaction.ts` — dipilih di income/expense akan "tersimpan"
tapi TIDAK PERNAH tercatat sebagai piutang/utang, bug senyap). Dua aturan
saling melengkapi, masing-masing di `useEffect` terpisah:

1. Pilih akun `debt` sebagai "Akun" → tipe otomatis dipaksa ke `transfer`.
2. User ganti tipe MENJAUH dari `transfer` sementara akun yang sedang
   terpilih bertipe `debt` → akun itu dikosongkan lagi (bukan reset
   SETIAP kali tipe berubah, supaya efek 1 tidak saling menganulir efek
   ini di render yang sama — makanya `previousTypeRef` dipakai untuk
   mendeteksi "tipe benar-benar baru saja berubah", bukan reaksi ke
   `sourceIsDebt`).

`type`/`form`/`sourceIsDebt` sengaja tidak selalu masuk dependency array
kedua effect itu — dibaca dari closure terbaru, supaya tidak retrigger
sendiri di render yang sama saat salah satu effect lain sudah menulis
nilai baru.

### `errorFieldFor`

Debt diperiksa lebih dulu di `validateAllFields` — kalau errornya BUKAN
dari debt (`validateDebtFields` return null) tapi `needsInvestmentFields`
true, error itu pasti berasal dari `validateInvestmentFields`, jadi
ditaruh di field `"unit"` supaya user diarahkan ke field yang relevan,
alih-alih `"contact_name"` yang tidak nyambung sama sekali.

## `use-transaction-debt-fields.ts`

Semua state dan validasi terkait field utang-piutang di form transaksi —
dikumpulkan di sini karena saling bergantung (`debtStatus` menentukan
apakah field dikunci DAN piutang mana yang tetap muncul di checklist).

- `debtStatus` dipakai DUA kali: mengunci field berbahaya (`debtFieldsLocked`)
  DAN memastikan piutang yang jadi target pembayaran transaksi ini SENDIRI
  tetap muncul di checklist `DebtActionField` meski statusnya sudah
  `'paid'` (lihat `use-ongoing-debts.ts`, param `excludeDebtId`/
  `excludeTransactionId`) — tanpa ini, edit transaksi yang tadinya
  melunasi PENUH sebuah piutang tidak bisa memilih ulang piutang yang
  sama di form.
- `pairKind` null kalau `type !== 'transfer'` ATAU salah satu akun belum
  dipilih — belum ada apa pun untuk diklasifikasikan. `classifyAccountPair`
  throw `UnsupportedAccountPairError` untuk kombinasi di luar cash/debt
  (lihat `classify-account-pair.ts`) — ditangkap di sini jadi pesan
  validasi form (REJECT SEBELUM SIMPAN, lihat
  `audit-kepatuhan-konsep-tipe-akun.md` pertanyaan #4), bukan dibiarkan
  lolos sampai `apply-debt-transaction.ts`.
- `debtFieldsLocked` — transaksi (mode edit) yang berperan sebagai
  piutang INDUK dan SUDAH menerima cicilan dari transaksi LAIN: field
  berbahaya (kontak, nominal, akun, aksi debt) dikunci read-only, karena
  merevisinya butuh recreate yang akan menghapus cicilan itu lewat
  CASCADE. Lihat `apply-debt-transaction.ts` (`applyDebtTransactionEdit`)
  dan "Edit transaksi yang sudah py debts terkait" di
  `debt-receivable-tracking.md`. Transaksi yang berperan sebagai
  PEMBAYARAN (bukan induk), atau induk yang belum punya cicilan, TETAP
  bebas diedit — recreate-nya aman.
- `needsDebtAction` — `debt → cash`: arah transfer semata ambigu
  (pelunasan piutang existing vs utang baru), lihat "Deteksi otomatis
  debts dari transfer" di `debt-receivable-tracking.md`. `debt → debt`
  sengaja TIDAK termasuk (di luar scope, tidak trigger apa pun).
- Validasi kelebihan bayar di `validateDebtFields` — konsisten dengan
  pola pembayaran nyata yang ditemukan di data ("Kak Ipit Paylater" —
  pokok & kelebihan SELALU 2 transaksi terpisah), lihat "Update besar"
  poin 5 di `debt-receivable-tracking.md`. Tanpa validasi ini, kelebihan
  bayar hilang begitu saja (`settleDebtsFifo` cuma mengalokasikan sampai
  piutang yang dicentang habis, sisanya dibuang).

## `use-transaction-investment-fields.ts`

Field unit/harga per unit MUNCUL begitu transfer melibatkan akun
`account_type='investment'` — dua arah didukung (lihat
`docs/concept/konsep-investasi.md`):

- `cash-investment` (beli): unit/harga OPSIONAL kalau status `'pending'`
  (revisi 2026-10-06) — order beli yang masih pending (mis. reksadana di
  Bibit) belum tahu unit pastinya sampai settlement dikonfirmasi, boleh
  dikosongkan dulu, diisi belakangan lewat edit baris
  `investment_purchases`. WAJIB kalau status `'settled'`.
- `investment-cash` (jual, 2026-10-07): unit/harga SELALU WAJIB — beda
  dari beli, jual tidak punya mekanisme "isi belakangan" (lihat
  `docs/concept/konsep-investasi.md` bagian "Input jual"). Field `amount`
  form JUGA otomatis dikunci (read-only) untuk arah ini — lihat
  `fields/investment-fields.tsx` dan `use-create-transaction.ts` soal
  kenapa (balance investment harus berkurang sebesar average cost,
  bukan nominal yang diketik user).

`UnsupportedAccountPairError` sudah ditangani sebagai pesan validasi di
`useTransactionDebtFields` (satu-satunya tempat yang menampilkannya ke
user) — di sini cukup anggap bukan kombinasi investment, tidak
dilempar ulang ke user.

## `use-account-category-options.tsx`

Opsi dropdown akun & kategori untuk form transaksi, plus render
icon+warna untuk opsi akun terpilih — dikumpulkan di sini karena
sama-sama bergantung pada `accounts`/`categories` mentah dan aturan
"tetap tampil kalau sedang dipakai transaksi yang diedit, walau sudah
nonaktif" yang sama untuk keduanya.

- Akun/kategori nonaktif disembunyikan dari opsi baru, tapi tetap
  ditampilkan kalau sedang dipakai transaksi yang diedit — supaya form
  edit tidak kehilangan nilai yang sudah tersimpan. Label menyertakan
  induk (grup akun / kategori induk) karena beberapa akun/kategori
  berbeda memakai nama yang sama persis.
- Icon+warna cuma bisa dirender di DALAM dropdown (`ComboboxItem`) —
  `ComboboxInput` adalah text input native, tidak mendukung custom
  render untuk nilai yang sudah terpilih. `renderAccountOption` lookup
  balik ke `accounts` dari `option.value` karena
  `FormFieldComboboxOption` generic cuma bawa `{value, label}`, tidak
  bawa data akun mentah.

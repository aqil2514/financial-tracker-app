# Icon Akun: Sudah Dibangun

## Latar belakang

Ditemukan saat membandingkan skema `accounts` dengan Money Manager
(`ASSETS`): kolom `accounts.icon` (`TEXT`, nullable) sudah ada di skema
database sejak awal, tapi TIDAK PERNAH dipakai oleh UI mana pun —
`AccountForm` (`features/accounts/form/account-form.tsx`) tidak punya
field untuk mengisinya, dan tidak ada tempat yang me-render `account.icon`.
Kolom ini selalu `NULL` di semua row. Fitur "setengah jadi": schema ada,
UI tidak ada.

## Keputusan yang sudah diambil

- **Format nilai**: `icon` menyimpan nama komponen `lucide-react` (mis.
  `"Wallet"`, `"CreditCard"`, `"PiggyBank"`) — dirender lewat lookup map
  nama→komponen. Konsisten dengan icon set yang sudah dipakai di seluruh
  aplikasi ini, tidak perlu asset/library baru.
- **Warna terpisah dari bentuk icon**: lucide-react sendiri monokrom
  (ikut `currentColor`, tidak ada warna bawaan) — kalau semua icon
  dirender dengan class yang sama, semuanya jadi satu warna, tidak ada
  variasi visual antar akun. Untuk mendapat variasi warna, PERLU kolom
  baru `accounts.color` (hex atau nama warna dari palet terbatas) yang
  dipilih user secara independen dari bentuk icon-nya — bukan icon dan
  warna digabung jadi satu pilihan.

## Status implementasi

SUDAH selesai:
- **Migrasi** `0015_account_color.sql` — `accounts.color TEXT` nullable,
  diverifikasi lewat simulasi SQL terhadap salinan `finance.dev.db`
  (`foreign_key_check` bersih), teregistrasi di `migrations.rs` versi 15.
- **Whitelist icon** (`lib/account-icons.ts`) — 18 nama icon lucide-react
  relevan konteks akun keuangan (Wallet, Banknote, PiggyBank, Landmark,
  CreditCard, Coins, TrendingUp, Bitcoin, Building2, HandCoins, Gem,
  Home, Car, Plane, ShoppingBag, Smartphone, Receipt, Gift), plus
  `resolveAccountIcon()` dengan fallback ke `Wallet` kalau null/nama
  tidak dikenali.
- **Palet warna** (`lib/account-colors.ts`) — 10 warna terbatas (slate,
  red, orange, amber, green, teal, blue, indigo, purple, pink) memakai
  className Tailwind polos (`text-{color}-600`/`bg-{color}-600`, TANPA
  varian `dark:` eksplisit — mengikuti pola yang sudah dipakai untuk
  income/expense/transfer di `transaction-list-item.tsx`), plus
  `resolveAccountColorText()` dengan fallback ke `slate`.
- **Komponen picker**: `FormFieldIconPicker`/`FormFieldColorPicker`
  (`components/form-fields/`) — grid pilihan di dalam `Popover`, dipicu
  dari tombol yang menampilkan pilihan saat ini. Diintegrasikan ke
  `AccountForm` (create & edit).
- **Persistensi**: `use-create-account.ts`/`use-update-account.ts` sudah
  menyertakan `icon`/`color` di SQL insert/update. Semua query akun yang
  sudah ada (`useAccounts`, `useAccountsPaginated`) pakai `accounts.*` /
  `SELECT *`, jadi kolom baru otomatis ikut ter-select tanpa perlu
  diubah.
- **Render — cakupan pertama**: daftar akun (`account-list/content/item.tsx`)
  menampilkan icon berwarna di kiri nama akun.
- **Render — cakupan kedua**: dropdown pilih akun di form transaksi
  (`FormFieldCombobox` diperluas dengan prop `renderOption` opsional,
  default tetap `item.label` polos supaya pemakai lain seperti kategori
  tidak terpengaruh) — `transaction-form.tsx` pasang `renderAccountOption`
  ke kedua combobox akun (`account_id`/`transfer_account_id`). **Batasan
  yang diketahui**: icon cuma muncul DI DALAM dropdown saat dibuka, TIDAK
  di kotak input yang menampilkan akun yang SUDAH terpilih —
  `ComboboxInput` (base-ui) adalah text input native, tidak mendukung
  custom render untuk nilai terpilih tanpa mengubah pola combobox secara
  lebih mendasar. Diputuskan diterima sebagai batasan (bukan blocker).
- Diverifikasi `tsc --noEmit` (bersih), `npm test` (94/94), `npm run
  build` (semua 14 route sukses) di setiap tahap.

BELUM dikerjakan (opsional, tidak prioritas):
- Render icon+color di tempat LAIN yang menampilkan akun: chart saldo
  per akun (`AccountBalancePieChart`), baris transaksi transfer
  (`transaction-list-item.tsx`), header `AccountDetailDialog`, dropdown
  filter akun di laporan/kalender. Sengaja ditunda satu-satu sesuai
  prinsip "jangan diterapkan ke semua tempat sekaligus kalau belum jelas
  manfaatnya" — kandidat berikutnya yang disebut paling bernilai:
  combobox akun (SUDAH selesai di atas).

## Catatan

Awalnya prioritas rendah (kosmetik/UX, bukan bug atau kehilangan data),
tapi dikerjakan tuntas dalam satu sesi begitu diangkat kembali — kolom
`icon` (lama) dan `color` (baru) sekarang keduanya benar-benar dipakai,
bukan dead column lagi.

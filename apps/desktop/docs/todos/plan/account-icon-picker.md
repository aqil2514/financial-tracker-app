# Icon Akun: Kolom Ada, UI Belum Dibangun

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

## Yang perlu dikerjakan (belum diputuskan urutan/detailnya)

- **Migrasi skema**: tambah kolom `accounts.color` (`TEXT`, nullable) —
  kolom `icon` sendiri sudah ada, tidak perlu migrasi untuk itu.
- **Komponen picker icon**: UI untuk memilih salah satu dari daftar nama
  icon lucide yang di-whitelist (bukan seluruh library, supaya daftar
  pilihan tidak kebanyakan) — perlu ditentukan daftar icon apa saja yang
  relevan untuk konteks akun keuangan (dompet, bank, kartu, tunai,
  investasi, dst).
- **Komponen picker warna**: palet warna terbatas (bukan color picker
  bebas) supaya hasilnya tetap konsisten dengan desain sistem aplikasi —
  perlu ditentukan daftar warna yang cocok dengan tema light/dark yang
  sudah ada.
- **Render icon+color**: di `account-list.tsx` (daftar akun), kemungkinan
  juga di tempat lain yang menampilkan akun (dropdown pilih akun di form
  transaksi, filter kategori/akun, chart saldo per akun) — perlu
  diputuskan seberapa luas cakupan render-nya, jangan langsung diterapkan
  ke semua tempat sekaligus kalau belum jelas manfaatnya di tiap lokasi.
- **Lookup map nama→komponen**: fungsi/util kecil yang memetakan string
  nama icon ke komponen `lucide-react` aktual, dengan fallback icon
  default kalau `icon` null atau nama tidak dikenali (mis. dari data lama
  yang belum diisi).

## Catatan

Prioritas rendah — kosmetik/UX, bukan bug atau kehilangan data. Dicatat
supaya kolom `icon` yang sudah ada di skema tidak terus jadi dead column,
dan supaya keputusan format nilai (lucide name + color terpisah) tidak
perlu didiskusikan ulang saat fitur ini akhirnya dikerjakan.

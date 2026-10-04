# Optimalisasi Import: Kategori Duplikat dari Money Manager

## Latar belakang

Import data dari Money Manager (`import_money_manager`, lihat
`features/data-import/`) saat ini memindahkan kategori "apa adanya" dari
sumbernya. Ditemukan kasus nyata di data hasil import: ada 3 baris berbeda
di tabel `categories` yang sama-sama bernama "Cryptocurrency" (id 104, 105,
107) — masing-masing anak dari parent yang berbeda (💹Investasi/income,
💹Trading/income, 💹Trading/expense).

Ini BUKAN bug di sistem filter atau di UI mana pun yang menampilkannya —
filter kategori (`list/list-context.tsx`'s `filterSelectOptions`) memang
menampilkan apa yang ada di tabel `categories` apa adanya, dan tiga baris
itu betul-betul row berbeda dengan `parent_id` berbeda. Ditemukan saat
memeriksa kenapa dropdown filter "Kategori" menampilkan "Cryptocurrency"
tiga kali.

## Masalah yang mau dioptimalkan

- Dropdown pilih kategori (filter, form transaksi) menampilkan nama yang
  sama berulang tanpa konteks parent-nya, membingungkan user memilih yang
  mana.
- Kemungkinan sebagian duplikat ini sebetulnya HARUS tetap terpisah (mis.
  "Cryptocurrency" di bawah income vs expense adalah dua kategori yang
  valid berbeda), tapi sebagian lain mungkin cuma duplikat murni akibat
  proses import (mis. dua "Cryptocurrency" yang sama-sama di bawah parent
  bertipe income tapi parent berbeda — perlu dicek apakah ini representasi
  data Money Manager yang memang begitu, atau redundansi yang bisa
  digabung saat import).

## Kemungkinan arah perbaikan (belum diputuskan)

- **Saat import**: deteksi kategori dengan `name` + `type` + parent yang
  sama persis sebelum insert, gabungkan jadi satu row alih-alih duplikat
  baru — perlu pelajari dulu struktur data sumber Money Manager (`.mmbak`)
  untuk tahu kenapa duplikat ini muncul (apakah dari struktur asli Money
  Manager, atau dari cara `import_money_manager` memetakannya).
- **Di UI saja (tanpa ubah data)**: label kategori di dropdown filter/form
  ditampilkan sebagai `"<Parent> > <Nama>"` (mis. "💹Investasi >
  Cryptocurrency") supaya user bisa membedakan tanpa perlu menyentuh data.
  Lebih aman (tidak berisiko mengubah `category_id` yang sudah
  direferensikan transaksi lama), tapi tidak menghilangkan duplikat itu
  sendiri di database.
- **Pembersihan data pasca-import**: tool/command terpisah untuk
  menggabungkan kategori duplikat pada data yang SUDAH ter-import —
  berisiko karena harus migrasikan `category_id` di semua transaksi yang
  mereferensikan kategori yang mau digabung; butuh rencana rollback/backup
  sebelum dijalankan pada data pengguna.

## Catatan

Untuk saat ini data dibiarkan apa adanya (bukan prioritas mendesak) —
dicatat di sini supaya tidak terlupa saat proses import ditinjau ulang.

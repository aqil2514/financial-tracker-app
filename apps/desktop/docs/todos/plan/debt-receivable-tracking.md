# Fitur Utang Piutang: Entitas Sendiri, Bukan Sekadar Transaksi

## Latar belakang

Muncul dari obrolan santai (bukan permintaan implementasi) soal
diferensiasi aplikasi ini dibanding app finance manager lain yang pernah
dipakai (Money Manager). Keluhan konkretnya: di app sebelumnya, utang
piutang cuma bisa dicatat sebagai transaksi biasa (income/expense/transfer
ke akun "Piutang" — lihat akun "Aqil Frozen Food" dengan tag "Piutang" di
data saat ini) — tidak ada rangkuman "siapa berutang berapa ke saya
sekarang". Kalau ditanya orangnya langsung, harus dicatat manual lagi di
luar app karena app-nya tidak bisa diandalkan untuk menjawab itu.

## Masalah inti

Bukan soal detail pencatatan per-transaksi kurang lengkap — masalahnya
hilangnya **pandangan per-orang**. Data individual mungkin ada tersebar
sebagai transaksi, tapi tidak ada satu tempat yang menjawab "si X total
masih pinjam berapa ke saya sekarang" tanpa menjumlahkan manual.

## Arah yang sudah disepakati (level obrolan, belum desain final)

- **Entitas baru** (`debts`/piutang-utang), bukan akun virtual per orang.
  Entitas ini punya identitas & status lifecycle sendiri (siapa, jumlah,
  status: belum lunas → dicicil → lunas), terpisah dari konsep akun.
- **Tetap menggerakkan saldo akun** — setiap pencairan/cicilan/pelunasan
  membuat transaksi income/expense/transfer normal seperti biasa, mirip
  pola yang sudah dipakai di [fitur koreksi saldo akun](../../../src/features/accounts/dialogs/balance-correction-dialog/)
  (entitas domain + transaksi otomatis sebagai jejak saldo). Jadi
  `balance` akun tetap akurat tanpa perlu logic terpisah.
- **Rangkuman per kontak** adalah fitur inti yang menjawab pain point —
  bukan sistem cicilan kompleks. Lifecycle status dibutuhkan justru
  supaya rangkuman itu bisa dipercaya dari waktu ke waktu (bisa bedakan
  piutang yang masih jalan vs yang sudah lunas), bukan cuma snapshot
  transaksi mentah yang harus dijumlah ulang tiap kali dilihat.

## Pertanyaan desain yang belum dijawab (untuk digali saat mau dieksekusi)

- Satu kontak bisa punya banyak piutang/utang terpisah (mis. Budi pinjam
  2× di bulan berbeda dicatat sebagai 2 entitas), atau digabung jadi satu
  saldo berjalan per kontak?
- Cicilan itu transaksi baru yang dikaitkan ke piutang/utang yang sama
  (relasi 1-ke-banyak), atau tiap cicilan dianggap entitas piutang baru?
- Status "lunas" ditentukan otomatis (begitu total cicilan tercatat sama
  dengan jumlah awal) atau ditandai manual oleh user?
- "Pihak lain" (si pemberi/penerima utang) — kontak bebas teks saja, atau
  entitas kontak tersendiri (yang bisa dipakai ulang lintas
  piutang/utang, punya riwayat sendiri)?
- Jatuh tempo & reminder — apakah masuk scope awal, atau menyusul setelah
  rangkuman dasar per kontak selesai?
- UI: halaman baru (`/debts`)? Card ringkasan di dashboard? Filter khusus
  di halaman akun/transaksi yang sudah ada?

## Catatan

Ini FITUR BARU (bukan bug/kehilangan data dari import). Belum ada
rencana implementasi konkret — dicatat sebagai referensi arah
diferensiasi produk kalau suatu saat fitur ini ingin dibangun. Prioritas
belum ditentukan.

# Konsep Utang Piutang di Aplikasi Ini

## Kenapa fitur ini ada

Di banyak aplikasi pencatatan keuangan (termasuk aplikasi yang dulu
dipakai sebelum ini), meminjamkan atau meminjam uang cuma dicatat
sebagai transaksi transfer biasa ke sebuah "akun" buatan bernama
semacam "Piutang" atau "Utang". Masalahnya: kalau suatu saat ditanya
"si Budi sekarang masih pinjam berapa ke saya?", jawabannya tidak bisa
langsung dilihat — harus menjumlahkan sendiri satu per satu semua
transaksi yang pernah tercatat dengan nama Budi, dan gampang keliru
kalau nama orangnya ditulis tidak konsisten (kadang "Budi", kadang
"budi minjem", dsb).

Aplikasi ini dibuat untuk bisa langsung menjawab pertanyaan seperti
itu, tanpa harus menjumlah manual.

## Arti angka positif/negatif pada saldo akun Utang/Piutang

Saldo akun bertipe Utang/Piutang punya makna terbalik dari intuisi
"kas" biasa, karena tanda angkanya ditentukan dari sudut pandang
**pemilik aplikasi**, bukan dari sudut pandang uangnya sendiri:

- **Negatif** — pemilik aplikasi yang **berutang** ke pihak lain (uang
  pihak lain yang sedang "dipegang").
- **Positif** — pemilik aplikasi yang **berpiutang** (orang lain yang
  berutang ke pemilik aplikasi).

Konsekuensinya: transfer **kas → Utang/Piutang** (meminjamkan uang)
membuat saldo akun itu makin **positif** (piutang baru ditambahkan),
sedangkan transfer **Utang/Piutang → kas** yang berarti utang baru
(meminjam dari orang lain) membuat saldo makin **negatif**. Pelunasan
piutang mengurangi saldo (ke arah nol), pelunasan utang menambah saldo
(juga ke arah nol) — baik piutang maupun utang sama-sama *mengarah ke
nol* saat diselesaikan, tinggal arah awalnya saja yang beda.

## Bagaimana piutang/utang "lahir" — otomatis dari arah transfer

Alih-alih membuat form terpisah khusus "Catat Piutang Baru" (yang
artinya ada cara baru yang harus diingat-ingat), aplikasi ini
memanfaatkan kebiasaan yang sudah ada: **transaksi transfer antar
akun**. Yang membedakan adalah satu dari dua akun yang terlibat
bertipe khusus "Utang/Piutang" (bukan akun kas/bank biasa).

- **Uang keluar dari kas, masuk ke akun "Utang/Piutang"** → ini
  diartikan sebagai **meminjamkan uang** (piutang baru). Nama orang
  yang dipinjami wajib diisi saat itu juga.
- **Uang keluar dari akun "Utang/Piutang", masuk ke kas** → ini
  diartikan sebagai **pelunasan atau cicilan** dari piutang yang sudah
  ada, atau bisa juga dicatat sebagai **utang baru** (meminjam uang
  dari orang lain) — aplikasi akan menanyakan maksudnya saat transaksi
  itu dibuat, karena kedua kemungkinan itu sama-sama masuk akal dari
  arah transfernya saja.

Jadi tidak ada "menu rahasia" terpisah — orang yang sudah terbiasa
mencatat transfer, tetap mencatat dengan cara yang sama, cuma kali ini
aplikasi lebih pintar menafsirkan maksudnya.

## Satu pelunasan bisa untuk beberapa piutang sekaligus

Kalau seseorang punya beberapa piutang yang belum lunas (misalnya
pernah dipinjami tiga kali di waktu berbeda), dan orang itu membayar
dalam satu kali transfer, aplikasi bisa membagi otomatis pembayaran
itu ke piutang-piutang yang ada — **piutang yang paling lama
dibuatlah yang dilunasi lebih dulu**. Kalau uang yang dibayarkan tidak
cukup untuk melunasi semuanya, sisanya dialokasikan ke piutang
berikutnya sampai uangnya habis, dan piutang yang belum kebagian tetap
tercatat "belum lunas".

Pembayaran tidak harus lunas sekaligus — bisa dicicil sedikit demi
sedikit lewat beberapa transaksi transfer terpisah, aplikasi akan
terus menjumlahkan berapa yang sudah dibayar dan berapa sisanya.

## Status piutang/utang

Setiap piutang atau utang yang tercatat selalu dalam salah satu dari
tiga keadaan:

- **Masih berjalan** — belum lunas, masih ada sisa yang harus dibayar.
- **Lunas** — sudah dibayar penuh.
- **Dihapuskan** — diputuskan tidak akan ditagih lagi (misalnya
  dianggap hangus), tanpa harus "berpura-pura" dibayar lunas padahal
  tidak.

Status ini yang membuat ringkasan "siapa masih berutang berapa" bisa
langsung dipercaya kapan pun dilihat, karena piutang yang sudah lunas
otomatis tidak lagi dihitung sebagai yang berjalan.

## Nama orang dicatat sebagai satu identitas, bukan teks bebas

Supaya rangkuman per orang itu bisa akurat, nama orang yang terlibat
dalam piutang/utang dicatat sebagai satu entitas yang konsisten (satu
kontak = satu identitas), bukan sekadar teks bebas yang gampang ditulis
beda-beda setiap kali. Ini penting karena nama yang sama tapi ditulis
tidak konsisten akan membuat satu orang terlihat seperti beberapa
orang berbeda dalam ringkasan, dan membuat totalnya jadi salah.

## Mengubah atau menghapus transaksi yang terlanjur berkaitan

Karena piutang/utang itu "lahir" dari sebuah transaksi (dan
cicilannya juga tercatat lewat transaksi), ada aturan khusus supaya
mengubah atau menghapus transaksi itu tidak sampai merusak catatan
piutang/utangnya tanpa disadari.

**Prinsip utamanya: nominal piutang/utang dan riwayat pembayarannya
tidak boleh berubah atau hilang hanya gara-gara satu transaksi
dihapus atau diedit** — kecuali memang transaksi itu sendiri yang
*merepresentasikan* uang yang dibayarkan (dalam hal ini wajar kalau
ikut terpengaruh).

### Saat mengedit transaksi

- Kalau transaksi itu adalah **cicilan/pelunasan** dan yang diubah
  cuma catatan/tanggal (bukan jumlah uang atau akunnya), perubahan
  disinkronkan begitu saja.
- Kalau yang diubah adalah **jumlah uangnya**, dan piutang itu
  belum pernah menerima cicilan dari transaksi lain, perubahan tetap
  aman dilakukan.
- Tapi kalau piutang itu **sudah pernah dicicil oleh transaksi lain**,
  dan yang mau diubah adalah transaksi **awal/pokok** piutangnya
  (jumlah uang, akun, atau nama orangnya) — perubahan ini **ditolak**.
  Alasannya: mengubah transaksi pokok dalam kondisi begini berisiko
  menghapus jejak cicilan yang sudah terjadi tanpa disadari. Piutangnya
  harus diselesaikan dulu (dilunasi/dihapuskan) sebelum pokoknya bisa
  diubah.

### Saat menghapus transaksi

- **Transaksi biasa** yang tidak ada kaitannya dengan piutang/utang —
  dihapus seperti biasa, tanpa efek lain.
- **Transaksi yang merupakan cicilan/pelunasan** — kalau dihapus,
  pencatatan cicilan itu ikut dibatalkan (piutang pokoknya kembali ke
  status "belum lunas penuh" kalau sebelumnya sempat tercatat lunas
  gara-gara cicilan itu). Nominal piutang pokoknya sendiri tidak
  berubah.
- **Transaksi yang merupakan awal/pokok dari sebuah piutang atau
  utang** — kalau dihapus, piutang/utangnya **tidak ikut hilang**.
  Nominal dan statusnya tetap persis sama seperti sebelumnya, baik
  piutang itu belum pernah dicicil maupun sudah pernah dicicil
  sebagian. Yang hilang hanya catatan "piutang ini berasal dari
  transaksi yang mana" — sesuatu yang tidak mempengaruhi angka yang
  dilihat pengguna sehari-hari.

Setelah penghapusan selesai, kalau ternyata transaksi yang baru
dihapus itu berkaitan dengan piutang/utang, aplikasi akan memberi
tahu lewat pesan singkat apa yang terjadi — bukan menginterupsi dengan
pertanyaan sebelum penghapusan dilakukan. Tidak perlu langkah
tambahan apa pun dari pengguna; aplikasi otomatis tahu tindakan apa
yang tepat tergantung situasinya.

## Berlaku konsisten dari mana pun dikelola

Aturan-aturan di atas berlaku sama persis baik transaksi dikelola
langsung dari aplikasi desktop, maupun (untuk sebagian fitur) lewat
pengelolaan jarak jauh menggunakan asisten AI dari HP — supaya hasil
akhirnya selalu konsisten, tidak peduli dari mana perubahan itu
dilakukan.

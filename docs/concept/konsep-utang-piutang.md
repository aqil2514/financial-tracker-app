# Konsep Utang Piutang di Aplikasi Ini

## Kenapa fitur ini ada

Di banyak aplikasi pencatatan keuangan (termasuk aplikasi yang dulu dipakai sebelum ini), meminjamkan atau meminjam uang cuma dicatat sebagai transaksi transfer biasa ke sebuah "akun" buatan bernama semacam "Piutang" atau "Utang". Masalahnya: kalau suatu saat ditanya "si Budi sekarang masih pinjam berapa ke saya?", jawabannya tidak bisa langsung dilihat — harus menjumlahkan sendiri satu per satu semua transaksi yang pernah tercatat dengan nama Budi, dan gampang keliru kalau nama orangnya ditulis tidak konsisten (kadang "Budi", kadang "budi minjem", dsb).

Aplikasi ini dibuat untuk bisa langsung menjawab pertanyaan seperti itu, tanpa harus menjumlah manual.

## Setiap akun Utang/Piutang punya arah (`direction`) yang tetap

**Revisi 2026-10-17** — bagian ini menggantikan total versi sebelumnya ("arah ditentukan dari arah transfer/tanda transaksi"), yang ditulis SEBELUM konsep `direction` di bawah ini ada. Versi lama itu sudah diikuti kode (lihat `new-debt-form.tsx`, `createDirectDebtIncome`/`Expense`) dan TERBUKTI menghasilkan bug nyata: akun yang secara nama khusus piutang bisa kepakai untuk utang (dan sebaliknya) tanpa ada yang mencegah, karena arah piutang/utangnya waktu itu cuma ditebak dari arah transfer/tipe transaksi, bukan dari identitas akunnya sendiri.

Setiap akun bertipe Utang/Piutang sekarang punya **`direction`** eksplisit, salah satu dari dua:

- **`payable`** — akun ini khusus mencatat **utang** (kita yang berutang ke pihak lain).
- **`receivable`** — akun ini khusus mencatat **piutang** (pihak lain yang berutang ke kita).

Tidak ada pilihan "netral"/dua-arah (`both`) — setiap akun Utang/Piutang WAJIB salah satu dari dua di atas. Kalau kebutuhannya memang mencatat dua arah ke pihak yang sama (mis. "Keluarga" kadang dipinjami kadang meminjamkan), itu dua akun terpisah ("Piutang Keluarga" dan "Utang Keluarga"), bukan satu akun yang ambigu arahnya — konsisten dengan [konsep-tipe-akun.md](konsep-tipe-akun.md) bagian "Grup akun untuk kasus campuran" (satu akun = satu sifat murni, campuran dipecah jadi akun virtual terpisah, disatukan tampilannya lewat grup kalau perlu).

**`direction` akun adalah sumber kebenaran untuk `debts.type`** — bukan lagi disimpulkan dari arah transfer atau tipe transaksi. Begitu sebuah akun dipakai, baris `debts` yang lahir/terpengaruh SELALU sejenis dengan `direction` akun itu: akun `payable` hanya pernah melahirkan/menyentuh `debts.type = 'payable'`, akun `receivable` hanya `'receivable'`. Transaksi apa pun yang mencoba membuat kombinasi bertentangan (mis. akun `payable` dipakai untuk mencatat piutang) harus ditolak, bukan diam-diam disimpan salah kategori.

## Arti angka positif/negatif pada saldo akun Utang/Piutang

Saldo akun bertipe Utang/Piutang punya makna terbalik dari intuisi "kas" biasa, karena tanda angkanya ditentukan dari sudut pandang **pemilik aplikasi**, bukan dari sudut pandang uangnya sendiri:

- **Negatif** — pemilik aplikasi yang **berutang** ke pihak lain (uang pihak lain yang sedang "dipegang"). Berlaku di akun `direction = 'payable'`.
- **Positif** — pemilik aplikasi yang **berpiutang** (orang lain yang berutang ke pemilik aplikasi). Berlaku di akun `direction = 'receivable'`.

Pelunasan piutang mengurangi saldo (ke arah nol), pelunasan utang menambah saldo (juga ke arah nol) — baik piutang maupun utang sama-sama *mengarah ke nol* saat diselesaikan, tinggal arah awalnya saja yang beda.

Ini berlaku untuk **SEMUA** cara penyelesaian, termasuk yang tidak melibatkan uang berpindah lewat akun kas (mis. "Dihapuskan"/diikhlaskan, atau diselesaikan lewat barter) — lihat [konsep-transaksi.md](konsep-transaksi.md) untuk penjelasan kenapa kasus-kasus itu tetap wajib direpresentasikan sebagai transaksi penutup, bukan sekadar perubahan status.

## Bagaimana piutang/utang "lahir" atau berubah — dua jalur, satu aturan arah

Ada dua jalur sah yang bisa membuat/mengubah baris `debts`, tergantung apakah ada uang kas yang ikut berpindah atau tidak. Di KEDUA jalur berlaku **satu aturan arah yang sama**, dilihat dari sudut pandang akun Utang/Piutang itu sendiri (bukan dari sudut kas):

- **Nilai masuk ke akun `payable`** (income langsung, atau transfer dari kas MASUK ke akun ini) → **utang berkurang** — sesuatu "melunasi" sebagian kewajiban kita.
- **Nilai keluar dari akun `payable`** (expense langsung, atau transfer dari akun ini KELUAR ke kas) → **utang bertambah** — kita baru menerima pinjaman/kewajiban baru.
- **Nilai masuk ke akun `receivable`** (income langsung, atau transfer dari kas MASUK ke akun ini) → **piutang bertambah** — kita baru meminjamkan.
- **Nilai keluar dari akun `receivable`** (expense langsung, atau transfer dari akun ini KELUAR ke kas) → **piutang berkurang** — orang lain melunasi ke kita.

Pola ini AWALNYA terasa kontra-intuitif untuk `payable` (kok nilai masuk = utang berkurang, bukan bertambah?) — tapi masuk akal begitu dilihat dari makna sehari-hari: **kas KELUAR dari kita untuk membayar** = nilai itu "masuk" ke akun utang sebagai pelunasan = utang berkurang. Sebaliknya, **kas MASUK ke kita sebagai pinjaman baru** = nilai itu "keluar" dari akun utang (akun utang melepaskan nilai ke kita) = utang bertambah. Tabel lengkap di bawah merangkum keempat kombinasi tiap jalur.

### Jalur 1 — Transfer kas ↔ akun Utang/Piutang (ada uang berpindah)

Alih-alih membuat form terpisah khusus "Catat Piutang Baru" (yang artinya ada cara baru yang harus diingat-ingat), aplikasi ini memanfaatkan kebiasaan yang sudah ada: **transaksi transfer antar akun**. Yang membedakan adalah satu dari dua akun yang terlibat bertipe khusus "Utang/Piutang" (bukan akun kas/bank biasa).

| `direction` akun | Arah transfer | Artinya |
|---|---|---|
| `payable` | Kas → akun (uang **masuk** ke akun payable, kas kita keluar) | Utang **berkurang** — pelunasan/cicilan dari utang yang sudah ada. |
| `payable` | Akun → kas (uang **keluar** dari akun payable, kas kita masuk) | Utang **bertambah** — pinjaman baru (baris `debts` baru, `type='payable'`). Nama kontak wajib diisi. |
| `receivable` | Kas → akun (uang **masuk** ke akun receivable, kas kita keluar) | Piutang **bertambah** — kita meminjamkan (baris `debts` baru, `type='receivable'`). Nama kontak wajib diisi. |
| `receivable` | Akun → kas (uang **keluar** dari akun receivable, kas kita masuk) | Piutang **berkurang** — orang lain melunasi/mencicil ke kita. |

Jadi tidak ada "menu rahasia" terpisah — orang yang sudah terbiasa mencatat transfer, tetap mencatat dengan cara yang sama, cuma kali ini aplikasi menafsirkan arahnya berdasarkan `direction` akun yang dipakai, bukan ditebak.

### Jalur 2 — Income/expense LANGSUNG di akun Utang/Piutang (tanpa uang berpindah di awal)

Tidak semua piutang/utang lahir dari uang yang benar-benar berpindah tangan pada momen itu. Contoh nyata: **beli barang, bayar belakangan** (utang dagang) — nilai barang sudah diterima dan jadi beban saat itu juga, tapi kas belum keluar sepeser pun. Jalur 1 (transfer) tidak bisa merepresentasikan ini karena tidak ada akun kas yang ikut terlibat sama sekali.

Untuk kasus begini, transaksi `income`/`expense` dicatat **langsung** pada akun Utang/Piutang itu sendiri (bukan transfer):

| `direction` akun | `type` transaksi | Artinya |
|---|---|---|
| `payable` | `income` (nilai masuk ke akun) | Utang **berkurang** — mis. dapat diskon/potongan utang tanpa bayar kas. Mengurangi `debts` ongoing milik akun ini. |
| `payable` | `expense` (nilai keluar dari akun) | Utang **bertambah** (baris `debts` baru, `type='payable'`) — mis. beli barang belum bayar. |
| `receivable` | `income` (nilai masuk ke akun) | Piutang **bertambah** (baris `debts` baru, `type='receivable'`). |
| `receivable` | `expense` (nilai keluar dari akun) | Piutang **berkurang** — mengurangi `debts` ongoing milik akun ini. |

**Kasus "bertambah"**: sama seperti Jalur 1 sisi kelahiran baru — nama kontak wajib diisi, baris `debts` baru lahir.

**Kasus "berkurang"**: sama persis mekanisme pelunasan yang sudah ada di Jalur 1 (lihat "Satu pelunasan bisa untuk beberapa piutang sekaligus" di bawah) — pengguna memilih **kontak**, lalu memilih **`debts` ongoing milik kontak itu** yang mau dikurangi, dialokasikan FIFO (piutang/utang paling lama dulu) ke pilihan tersebut. Satu-satunya beda dari Jalur 1: `debt_payments` yang lahir tidak merujuk akun kas apa pun (tidak ada uang yang pindah lewat akun lain), transaksi `income`/`expense` itu sendiri yang jadi buktinya.

**Kalau tidak ada `debts` ongoing sama sekali yang bisa dikurangi** (mis. income pada akun `payable` padahal belum pernah ada utang tercatat di akun itu) — transaksi **ditolak**. Tidak masuk akal mengurangi sesuatu yang belum ada.

## Satu pelunasan bisa untuk beberapa piutang sekaligus

Kalau seseorang punya beberapa piutang yang belum lunas (misalnya pernah dipinjami tiga kali di waktu berbeda), dan orang itu membayar dalam satu kali transfer, aplikasi bisa membagi otomatis pembayaran itu ke piutang-piutang yang ada — **piutang yang paling lama dibuatlah yang dilunasi lebih dulu**. Kalau uang yang dibayarkan tidak cukup untuk melunasi semuanya, sisanya dialokasikan ke piutang berikutnya sampai uangnya habis, dan piutang yang belum kebagian tetap tercatat "belum lunas".

Pembayaran tidak harus lunas sekaligus — bisa dicicil sedikit demi sedikit lewat beberapa transaksi transfer terpisah, aplikasi akan terus menjumlahkan berapa yang sudah dibayar dan berapa sisanya.

## Status piutang/utang

Setiap piutang atau utang yang tercatat selalu dalam salah satu dari tiga keadaan:

- **Masih berjalan** — belum lunas, masih ada sisa yang harus dibayar.
- **Lunas** — sudah dibayar penuh.
- **Dihapuskan** — diputuskan tidak akan ditagih lagi (misalnya dianggap hangus), tanpa harus "berpura-pura" dibayar lunas padahal tidak.

Status ini yang membuat ringkasan "siapa masih berutang berapa" bisa langsung dipercaya kapan pun dilihat, karena piutang yang sudah lunas otomatis tidak lagi dihitung sebagai yang berjalan.

## Nama orang dicatat sebagai satu identitas, bukan teks bebas

Supaya rangkuman per orang itu bisa akurat, nama orang yang terlibat dalam piutang/utang dicatat sebagai satu entitas yang konsisten (satu kontak = satu identitas), bukan sekadar teks bebas yang gampang ditulis beda-beda setiap kali. Ini penting karena nama yang sama tapi ditulis tidak konsisten akan membuat satu orang terlihat seperti beberapa orang berbeda dalam ringkasan, dan membuat totalnya jadi salah.

## Mengubah atau menghapus transaksi yang terlanjur berkaitan

Karena piutang/utang itu "lahir" dari sebuah transaksi (dan cicilannya juga tercatat lewat transaksi), ada aturan khusus supaya mengubah atau menghapus transaksi itu tidak sampai merusak catatan piutang/utangnya tanpa disadari.

**Prinsip utamanya: nominal piutang/utang dan riwayat pembayarannya tidak boleh berubah atau hilang hanya gara-gara satu transaksi dihapus atau diedit** — kecuali memang transaksi itu sendiri yang *merepresentasikan* uang yang dibayarkan (dalam hal ini wajar kalau ikut terpengaruh).

### Saat mengedit transaksi

- Kalau transaksi itu adalah **cicilan/pelunasan** dan yang diubah cuma catatan/tanggal (bukan jumlah uang atau akunnya), perubahan disinkronkan begitu saja.
- Kalau yang diubah adalah **jumlah uangnya**, dan piutang itu belum pernah menerima cicilan dari transaksi lain, perubahan tetap aman dilakukan.
- Tapi kalau piutang itu **sudah pernah dicicil oleh transaksi lain**, dan yang mau diubah adalah transaksi **awal/pokok** piutangnya (jumlah uang, akun, atau nama orangnya) — perubahan ini **ditolak**. Alasannya: mengubah transaksi pokok dalam kondisi begini berisiko menghapus jejak cicilan yang sudah terjadi tanpa disadari. Piutangnya harus diselesaikan dulu (dilunasi/dihapuskan) sebelum pokoknya bisa diubah.

### Saat menghapus transaksi

- **Transaksi biasa** yang tidak ada kaitannya dengan piutang/utang — dihapus seperti biasa, tanpa efek lain.
- **Transaksi yang merupakan cicilan/pelunasan** — kalau dihapus, pencatatan cicilan itu ikut dibatalkan (piutang pokoknya kembali ke status "belum lunas penuh" kalau sebelumnya sempat tercatat lunas gara-gara cicilan itu). Nominal piutang pokoknya sendiri tidak berubah.
- **Transaksi yang merupakan awal/pokok dari sebuah piutang atau utang** — kalau dihapus, piutang/utangnya **tidak ikut hilang**. Nominal dan statusnya tetap persis sama seperti sebelumnya, baik piutang itu belum pernah dicicil maupun sudah pernah dicicil sebagian. Yang hilang hanya catatan "piutang ini berasal dari transaksi yang mana" — sesuatu yang tidak mempengaruhi angka yang dilihat pengguna sehari-hari.

Setelah penghapusan selesai, kalau ternyata transaksi yang baru dihapus itu berkaitan dengan piutang/utang, aplikasi akan memberi tahu lewat pesan singkat apa yang terjadi — bukan menginterupsi dengan pertanyaan sebelum penghapusan dilakukan. Tidak perlu langkah tambahan apa pun dari pengguna; aplikasi otomatis tahu tindakan apa yang tepat tergantung situasinya.

## Berlaku konsisten dari mana pun dikelola

Aturan-aturan di atas berlaku sama persis baik transaksi dikelola langsung dari aplikasi desktop, maupun (untuk sebagian fitur) lewat pengelolaan jarak jauh menggunakan asisten AI dari HP — supaya hasil akhirnya selalu konsisten, tidak peduli dari mana perubahan itu dilakukan.

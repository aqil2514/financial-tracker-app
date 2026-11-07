# Konsep Valas di Aplikasi Ini

> Status: konsep disepakati 2026-11-07, BELUM ada satu baris kode pun. Rencana eksekusi ada di [apps/desktop/docs/todos/plan/account-type-forex.md](../../apps/desktop/docs/todos/plan/account-type-forex.md).

## Kebutuhan awal

Pemicunya pemakaian nyata: pengguna membeli USD lewat poket valas BCA, dan aplikasi belum punya tempat mencatatnya. Untuk sekarang USD hanya disimpan, tapi kemungkinan nanti dipakai untuk transaksi langsung dalam USD. Kurs terkini cukup diinput manual.

## Mirip investasi: modal, unit, nilai terkini

Tipe akun **Valas** (`account_type = 'forex'`, lihat [konsep-tipe-akun.md](konsep-tipe-akun.md)) meniru model [konsep-investasi.md](konsep-investasi.md). Yang tetap adalah jumlah mata uang asingnya, sedangkan nilai rupiahnya berubah mengikuti kurs.

| Investasi | Valas |
|---|---|
| Satu akun = satu instrumen | Satu akun = satu mata uang (misalnya "BCA Poket USD") |
| Modal = `accounts.balance` (rupiah) | Sama: rupiah yang dikeluarkan untuk membeli |
| Unit | Jumlah mata uang asing yang dipegang (angka yang tetap) |
| Harga per unit saat beli | Kurs beli |
| Nilai pasar terkini | Unit × kurs terkini |
| Unrealized P/L | Nilai terkini − modal |
| Jual: average cost, Realized P/L | Sama: tukar ke rupiah, selisih kurs jadi laba/rugi terealisasi |

## Perbedaan dari investasi (disepakati 2026-11-07)

- **Kurs terkini diinput per unit, bukan nilai total.** Angka yang dilihat orang adalah kurs ("1 USD = Rp16.200"), jadi nilai terkini = `unit × kurs`. Ini kebalikan dari investasi, yang memakai `current_market_value` total karena orang melihat nilai portofolio, bukan harga per unit.
- **Tidak ada status `pending`/`settled`.** Beli di poket valas langsung masuk, jadi tidak ada settlement tertunda. Konsekuensinya tidak ada aksi Settle dan tidak ada aturan "jual pending tidak insert transaksi".
- **Transaksi langsung dalam mata uang asing ditunda.** Bayar atau terima langsung dalam USD belum didukung. Jalur yang ada: beli (rupiah ke valas) dan jual (valas ke rupiah). Fondasi unit dibuat supaya tidak menghalangi fitur itu nanti.

## Kurs terkini = kurs yang akan diterima saat menukar kembali

Bank punya dua kurs: kurs jual (yang dibayar nasabah saat membeli valas) dan kurs beli (yang diterima nasabah saat menukar valas kembali ke rupiah), dan kurs beli lebih rendah. Istilah ini terbalik dari sudut pandang nasabah, jadi label di UI harus jelas.

Kurs terkini sebaiknya diisi dengan kurs beli bank, bukan kurs yang dibayar saat membeli. Kalau tidak, Unrealized P/L terlihat nol padahal uang yang benar-benar akan diterima sudah lebih rendah akibat spread. Dengan begitu P/L langsung setelah membeli akan sedikit negatif, dan itu memang yang terjadi secara riil. Ini sekadar panduan pengisian, aplikasi tidak memvalidasi kurs apa yang diinput.

## Satu poket bank bisa berisi banyak mata uang

Poket Valas BCA mendukung belasan mata uang dalam satu poket. Di aplikasi tetap satu akun satu mata uang, jadi satu poket dengan USD dan EUR menjadi dua akun yang dikelompokkan lewat grup akun (lihat "Grup akun untuk kasus campuran" di [konsep-tipe-akun.md](konsep-tipe-akun.md)).

## Mata uang fleksibel, input teks

Detail akun valas menyimpan **negara** dan **kode/satuan mata uang**, keduanya input teks bebas (misalnya "Amerika Serikat" dan "USD"), plus kurs terkini manual. Tidak ada daftar mata uang baku, supaya pengguna bisa mencatat mata uang apa pun.

## Total kekayaan tetap berbasis modal rupiah

Sama seperti investasi, agregat total kekayaan menjumlah `accounts.balance` (modal rupiah) untuk semua tipe akun, termasuk Valas. Nilai terkini dan Unrealized P/L tampil sebagai info tambahan di samping. Akibatnya tidak ada laporan yang perlu mengonversi antar mata uang, dan itu sebabnya arah "akun bermata uang asing" yang menyentuh semua laporan sengaja tidak dipilih.

## Mencatat pembelian yang sudah terjadi

Catat pembelian dengan tanggal aslinya: jumlah unit, kurs beli, dan akun rupiah sumbernya. Kalau sumber rupiahnya tidak ingin dilacak, pakai jalur `direct` seperti saldo awal investasi (lihat bagian "Unit yang berubah TANPA transfer kas" di [konsep-investasi.md](konsep-investasi.md)).

## Tahap lanjutan: unit yang bergerak tanpa menjadi rupiah (dicek terhadap Poket Valas BCA, 2026-11-07)

Tahap pertama hanya beli dan jual ke rupiah. Poket Valas BCA punya jalur lain yang menggerakkan unit tanpa rupiah, dan ini dicatat sebagai tahap lanjutan, belum diputuskan desainnya:

- **Belanja atau tarik tunai dengan kartu debit** di luar negeri memotong saldo valas langsung, tanpa konversi ke rupiah. Ini jalur pemakaian USD yang paling mungkin dipakai, jadi prioritasnya tinggi untuk tahap berikutnya. Yang perlu diputuskan: balance berkurang sebesar average cost × unit, dan selisihnya dengan nilai belanja diperlakukan bagaimana.
- **Tarik atau setor uang kertas (banknotes)** di cabang, 1:1 antara poket dan uang tunai valas.
- **Transfer valas** ke Poket Valas lain, rekening BCA lain, atau bank lain. Untuk transfer antar akun valas bermata uang sama, modal harus ikut pindah dengan average cost, dan ini belum dibahas.
- **Biaya yang dipotong dalam valas.** Polanya mirip write-off unit di investasi.

Kalau saldo valas kurang saat memakai kartu, fitur Debet Rekening Induk memotong rupiah dari rekening induk. Itu pengeluaran rupiah biasa dan tidak menyentuh akun valas.

## Yang SENGAJA belum didukung

- Kurs otomatis dari API, kurs terkini murni manual.
- Transaksi langsung dalam mata uang asing (lihat "Tahap lanjutan" di atas).
- Biaya admin dan selisih kurs jual-beli bank sebagai field khusus. Kurs yang diinput adalah kurs yang benar-benar dibayar, dan biaya admin kalau ada dicatat sebagai transaksi pengeluaran biasa.

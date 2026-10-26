# Konsep Kategori di Aplikasi Ini

## Kategori sebagai label klasifikasi transaksi

Kategori adalah label yang menjelaskan **untuk apa** sebuah transaksi pemasukan/pengeluaran terjadi — "Makan", "Transport", "Gaji", dan semacamnya. Kategori menempel ke transaksi lewat `transactions.category_id`, dan dipakai terutama untuk kebutuhan laporan (rekap pengeluaran per kategori, dsb).

## Kategori dipisah ketat per tipe — transfer tidak punya kategori

Kategori **tidak generik lintas tipe transaksi**. Setiap kategori hanya punya satu tipe: `income` atau `expense` (`categories.type`, `CHECK (type IN ('income', 'expense'))`). Tidak ada kategori gabungan yang bisa dipakai untuk kedua tipe sekaligus.

Transaksi bertipe **transfer** tidak punya kategori sama sekali — field kategori di form transaksi diganti sepenuhnya jadi field "Akun Tujuan" saat tipe transaksi diisi transfer. Ini konsisten dengan sifat transfer: uang berpindah antar akun milik sendiri, bukan "dipakai untuk sesuatu" yang perlu diklasifikasi.

Saat memilih kategori di form transaksi, opsi yang muncul selalu difilter sesuai tipe transaksi yang sedang diisi — kategori `expense` tidak akan muncul sebagai opsi saat mengisi transaksi `income`, dan sebaliknya.

## Hierarki: flat di database, dua level di tampilan

Kategori mendukung hierarki parent/child lewat `categories.parent_id` (self-referencing, `ON DELETE SET NULL`). Secara skema database ini tidak dibatasi kedalamannya — tapi secara praktik dan tampilan, aplikasi hanya memperlakukannya sebagai **dua level**: kategori akar (tanpa parent) dan anak langsungnya. Tidak ada rekursi lebih dalam dari itu di UI manapun.

Anak kategori harus **satu tipe** dengan induknya — tidak bisa kategori `expense` punya anak `income` atau sebaliknya.

## Field `icon` ada di skema, tapi tidak aktif dipakai

Tabel kategori punya kolom `icon TEXT`, peninggalan dari seed data awal (diisi nama ikon seperti `"utensils"`, `"car"`). Tapi kolom ini **tidak pernah muncul** di form create/edit kategori maupun ditampilkan di kartu/list kategori manapun — murni kolom mati secara UI saat ini. Tidak ada field warna sama sekali untuk kategori (berbeda dari akun, yang punya warna).

Kalau suatu saat field ini mau betul-betul diaktifkan (ditampilkan dan bisa dipilih), itu keputusan desain baru yang perlu dipikirkan terpisah — bukan sekadar "menghidupkan kembali" sesuatu yang sudah ada polanya.

## Status aktif/nonaktif, bukan dihapus

Kategori punya flag `is_active` yang bisa di-toggle cepat tanpa membuka form edit penuh — dipakai untuk menyembunyikan kategori yang sudah tidak relevan dipakai lagi dari opsi pemilihan, tanpa kehilangan riwayat transaksi lama yang masih menempel ke kategori itu. Pola ini sejalan dengan prinsip "tipe itu permanen, kondisi saat ini dicatat terpisah" yang dibahas di [konsep-tipe-akun.md](konsep-tipe-akun.md) — bedanya di sini yang bergerak adalah status aktif, bukan status seperti lunas/berjalan.

## Menghapus kategori yang masih dipakai

Kategori boleh dihapus kapan saja, tapi aplikasi tidak membiarkan penghapusan "diam-diam meninggalkan data yatim". Kalau kategori yang mau dihapus masih punya sub-kategori dan/atau transaksi yang menempel padanya, pengguna wajib memilih lebih dulu salah satu dari dua opsi sebelum penghapusan diizinkan:

- **Lepas** (unassign) — transaksi/sub-kategori terkait jadi tanpa kategori/tanpa induk.
- **Pindahkan** (reassign) — transaksi/sub-kategori terkait dipindah ke kategori/induk lain yang dipilih.

Baru setelah salah satu pilihan ini dibuat eksplisit, baris kategori benar-benar dihapus.

## Membuat kategori baru langsung dari form transaksi

Kategori tidak harus dibuat lebih dulu lewat halaman data master sebelum dipakai. Saat mengisi form transaksi, field kategori berupa combobox yang bisa dicari — kalau nama yang diketik tidak cocok dengan kategori manapun yang sudah ada, muncul opsi "Buat baru: <nama yang diketik>". Memilih opsi itu membuka form kategori (dialog kecil di atas form transaksi) untuk melengkapi detail (tipe, induk kalau perlu), lalu kategori baru itu langsung terpakai di transaksi yang sedang diisi — tanpa pengguna harus keluar dari alur pengisian transaksi.

## Kategori Periode — bukan anggaran, murni agregasi

Terpisah dari kategori itu sendiri, ada konsep **Kategori Periode** (`category_periods`): jendela tanggal custom bernama (misalnya "Musim Panen 2026") yang mengikat **banyak kategori sekaligus, lintas tipe income maupun expense**, lewat tabel penghubung `category_period_categories` (relasi banyak-ke-banyak).

Kategori Periode **bukan fitur anggaran/budget** — tidak ada batas pengeluaran yang ditetapkan di muka, tidak ada status "melebihi anggaran". Fungsinya murni meringkas: berapa total masuk dan keluar dari kategori-kategori tertentu, dalam rentang tanggal tertentu. Tidak ada tabel ledger atau snapshot tersendiri untuk ini — ringkasannya selalu dihitung ulang langsung dari tabel `transactions` tiap kali dilihat (`WHERE category_id IN (...) AND date BETWEEN start_date AND end_date`), sama seperti saldo akun yang juga selalu dihitung turunan, bukan disimpan sebagai angka tetap.

Kenapa perlu lintas tipe: satu periode nyata (misalnya "panen") biasanya menggabungkan kategori pengeluaran (pupuk, bibit) **dan** kategori pemasukan (hasil jual) sekaligus — kalau dibatasi satu tipe saja, periode itu tidak bisa menjawab pertanyaan "untung-rugi bersih dari musim ini berapa".

## Catatan: dokumen ini menjelaskan konsep di aplikasi desktop

Per penulisan dokumen ini, konsep di atas merujuk ke implementasi yang sudah berjalan di `apps/desktop`. Aplikasi mobile belum memiliki fitur kategori — kalau porting dilakukan nanti, dokumen ini jadi rujukan konsep dasarnya, tapi keputusan teknis porting (termasuk apakah Kategori Periode ikut diporting, dan apakah field `icon` yang selama ini mati justru diaktifkan di mobile) adalah keputusan terpisah yang perlu didiskusikan saat porting itu dimulai, bukan diasumsikan otomatis mengikuti dokumen ini.

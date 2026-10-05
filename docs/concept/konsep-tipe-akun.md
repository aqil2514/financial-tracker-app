# Konsep Tipe Akun di Aplikasi Ini

## Akun sebagai tumpuan semua data

Semua pencatatan di aplikasi ini — transaksi, piutang/utang, nantinya investasi, dan fitur-fitur lain — pada akhirnya selalu menempel ke sebuah **akun**. Akun bukan sekadar "dompet" dalam pengertian sehari-hari, melainkan tumpuan yang menentukan **fitur apa saja yang relevan untuknya** — satu jenis akun bisa punya fitur yang tidak masuk akal untuk jenis akun lain.

Karena itu, setiap akun punya **tipe** yang menentukan sifatnya. Tipe ini yang jadi dasar aplikasi memutuskan cara memperlakukan akun tersebut — bukan nama akunnya.

Tipe ini **murni teknis** (dibaca kode, menentukan fitur apa yang tersedia), beda dari **grup akun** yang sudah ada sekarang — grup sifatnya netral, cuma label pengelompokan bebas pilihan pengguna untuk kebutuhan tampilan (lihat "Grup akun untuk kasus campuran" di bawah).

## Tipe ditentukan dari sifat nyata, bukan dari teori baku

Tipe akun di sini **tidak** diambil dari teori akuntansi formal (misalnya lima kategori baku dalam pembukuan standar: Aset, Liabilitas, Modal, Pendapatan, Beban). Aplikasi ini memakai pencatatan satu sisi (mencatat uang masuk/keluar langsung), bukan pencatatan dua sisi berpasangan seperti pembukuan formal — jadi tipe akun di sini dibangun dari **pengalaman nyata pemakaian**, bukan diturunkan dari kerangka teori itu.

Pendekatannya: amati sifat uang itu sendiri di dunia nyata, lalu kelompokkan berdasarkan sifat itu. Dua tipe yang sudah ada sekarang:

- **Kas** — uang yang bisa langsung dipakai kapan saja: uang tunai, saldo rekening bank, e-wallet, dan sejenisnya. Sifat utamanya: *likuid*, siap pakai tanpa proses tambahan.
- **Utang/Piutang** — uang milik kita yang sedang "berada" di tangan orang lain (piutang), atau sebaliknya uang milik orang lain yang sedang "berada" di tangan kita (utang). Sifat utamanya: nilainya nyata dan kita punya hak/kewajiban atasnya, tapi tidak bisa langsung dipakai sampai diselesaikan (ditagih atau dibayar).

## Tipe yang akan menyusul

Seiring kebutuhan baru muncul, daftar tipe ini akan terus bertambah. Beberapa yang sudah terpikirkan:

- **Investasi** — uang yang ditanamkan dan nilainya bisa naik-turun (reksadana, saham, dsb). Beda dari kas: tidak bisa langsung dicairkan kapan saja, dan nilainya tidak tetap.
- **Dana Pihak Ketiga** — uang yang secara fisik tercampur di kas kita, tapi secara substansi bukan milik kita (misalnya titipan tabungan orang lain). Sifatnya penting dibedakan dari kas biasa karena asal dan statusnya berbeda, meskipun aplikasi tidak menghakimi apakah saldo ini "boleh" dianggap kekayaan pribadi atau tidak (lihat "Laporan menampilkan angka apa adanya" di bawah).
- **Valas** — uang dalam mata uang negara lain. Beda dari kas rupiah karena nilainya mengikuti kurs yang berubah-ubah.

Setiap tipe baru ini nantinya bisa membawa fitur dan aturan tampilan laporan masing-masing, sama seperti dua tipe yang sudah ada sekarang.

## Laporan menampilkan angka apa adanya, bukan membuat penilaian

Laporan saldo/rekap di aplikasi ini **tidak** mencoba menilai mana yang "layak" dihitung sebagai kekayaan pribadi dan mana yang tidak (misalnya mengecualikan dana titipan pihak ketiga dari total). Semua akun ditampilkan apa adanya — baik per akun, per grup, maupun totalnya. Keputusan soal makna angka itu (apakah suatu saldo "benar-benar milik saya" atau tidak) diserahkan sepenuhnya ke penggunanya sendiri saat membaca laporan, bukan dihakimi lebih dulu oleh aplikasi.

## Grup akun untuk kasus campuran

Satu akun hanya boleh punya **satu** tipe — tidak ada akun yang "separuh kas separuh dana pihak ketiga". Kalau secara fisik ada uang bercampur sifat (misalnya di satu e-wallet berisi Rp500rb uang pribadi dan Rp100rb titipan orang), itu dipecah jadi **dua akun virtual terpisah** yang masing-masing tipenya murni satu — bukan satu akun dengan tipe campuran.

**Grup akun** (sudah ada sekarang sebagai pengelompokan bebas) berperan menjembatani kebutuhan tampilan di sini — grup itu sendiri **netral**, cuma wadah pengelompokan, tidak membawa logic/fitur apa pun. Contoh: "E-Wallet / Pribadi" dan "E-Wallet / Third Party" bisa jadi dua grup berbeda yang masing-masing menampung akun virtual bertipe murni, walaupun secara fisik keduanya cuma satu aplikasi e-wallet yang sama.

## Konsekuensi tipe — fitur yang tersedia beda per tipe

Tiap tipe akun membuka fitur yang relevan dengan sifatnya, dan menutup yang tidak relevan:

- Tipe **Kas** memungkinkan fitur seperti **cash opname** (mencocokkan saldo pencatatan dengan uang fisik yang benar-benar dipegang) — fitur ini tidak masuk akal untuk tipe lain karena cuma kas yang bisa "dipegang dan dihitung langsung".
- Tipe **Investasi** (saat sudah tersedia) memungkinkan fitur seperti **laba/rugi belum terealisasi** (selisih antara nilai beli dan nilai pasar saat ini, yang belum benar-benar dicairkan) — fitur ini juga tidak relevan untuk kas (nilainya memang tidak berubah-ubah) maupun utang/piutang (nilainya tetap, bukan mengikuti harga pasar).
- Tipe **Utang/Piutang** punya fiturnya sendiri untuk mencatat siapa berutang berapa, status lunas/berjalan, dan riwayat cicilan — lihat [konsep-utang-piutang.md](konsep-utang-piutang.md).

## Tipe itu permanen, kondisi saat ini dicatat terpisah

Tipe sebuah akun menjawab pertanyaan "ini akun jenis apa" — jawabannya tidak berubah seiring waktu. Tapi *kondisi* akun itu bisa berubah (misalnya piutang yang tadinya berjalan jadi lunas, atau nantinya investasi yang tadinya aktif jadi dicairkan). Perubahan kondisi ini dicatat lewat field **status** yang terpisah dari tipe, bukan dengan mengubah tipenya.

Pola ini sudah dipakai di fitur Utang/Piutang sekarang: tipe akunnya (Utang/Piutang) tidak pernah berubah, yang berubah adalah status piutangnya sendiri (berjalan/lunas/dihapuskan). Pola yang sama berlaku untuk tipe lain nantinya — tipe tetap, status yang bergerak.

## Mengubah tipe akun yang salah pilih di awal

Tipe akun **boleh** diubah, tapi hanya **selama akun itu belum pernah dipakai mencatat transaksi apa pun**. Begitu transaksi pertama masuk, tipe akun **terkunci** — tidak bisa diganti lagi.

Alasannya: kalau tipe akun diizinkan berubah setelah dipakai lama, semua transaksi yang sudah tercatat jadi "ditafsirkan ulang" dengan sifat barunya secara diam-diam, tanpa transaksi itu sendiri benar-benar berubah. Laporan historis bisa berubah maknanya tanpa jejak yang jelas, padahal secara visual tidak ada yang kelihatan "berubah" di catatan transaksinya.

Kalau sampai salah pilih tipe padahal akunnya sudah terlanjur dipakai, jalan keluarnya: buat akun baru dengan tipe yang benar, lalu pindahkan riwayatnya ke sana. Lebih merepotkan dibanding sekadar mengganti field, tapi menjamin laporan historis tidak pernah berubah makna tanpa alasan yang jelas.

## Koreksi saldo TIDAK menyentuh data turunan — berlaku untuk semua tipe

Fitur "Koreksi Saldo" (`correctAccountBalance`, dipakai lewat UI maupun tool MCP `correct_account_balance`) bekerja dengan menghitung selisih antara saldo target dan saldo saat ini, lalu membuat SATU transaksi `income`/`expense` penutup senilai selisih itu — ditulis **langsung** ke tabel `transactions`, TIDAK lewat jalur pencatatan transaksi normal (`createTransactionRow`/`insertTransaction`). Ini contoh pertama dari pola "transaksi penutup" yang dibahas lebih umum di [konsep-transaksi.md](konsep-transaksi.md).

Ini bukan sekadar detail teknis satu fitur, tapi konsekuensi struktural dari "akun sebagai tumpuan": begitu sebuah tipe akun punya data turunan yang biasanya ikut terpicu otomatis dari transaksi (lewat logic bisnis spesifik tipe itu), koreksi saldo **selalu** melewati logic itu, apa pun tipe akunnya — karena koreksi saldo memang dirancang generik di level "akun + transaksi penutup", bukan disadari tiap tipe. Jadi ini pola yang akan berulang untuk SETIAP tipe akun yang membawa data turunan, bukan cuma kasus yang kebetulan sudah terjadi sekarang.

Kasus yang sudah terbukti nyata (bukan hipotesis): tipe **Utang/Piutang** punya logic `applyDebtTransaction` yang biasanya membuat/memutakhirkan baris `debts` dari transfer cash↔debt (lihat [konsep-utang-piutang.md](konsep-utang-piutang.md)). Koreksi saldo pada akun bertipe ini mengubah **saldo akunnya** tanpa membuat atau menyesuaikan **satu pun baris `debts`** — saldo akun dan rincian "siapa berutang berapa" jadi tidak lagi saling menjelaskan, dan harus diperbaiki terpisah secara manual.

**Implikasi praktis**: sebelum memakai koreksi saldo di sebuah akun, tanya dulu "tipe akun ini punya data turunan yang biasanya ikut terpicu dari transaksi normal?" — kalau tidak (seperti tipe Kas sekarang, belum ada data turunan apa pun yang bergantung padanya), koreksi saldo aman dipakai apa adanya. Kalau ya (seperti Utang/Piutang sekarang, dan berpotensi tipe lain nanti — misalnya Investasi dengan riwayat nilai beli/jual), koreksi saldo cuma memperbaiki angka **total** di permukaan; data turunannya tetap harus diperiksa dan diperbaiki terpisah kalau memang perlu tetap konsisten dengan saldo barunya. Jangan pernah berasumsi koreksi saldo otomatis menjaga konsistensi turunan apa pun, utk tipe akun apa pun.

## Kenapa prinsip ini penting dijaga

Begitu sebuah data (misalnya satu piutang) tidak jelas menempel ke akun bertipe apa, tidak bisa dipastikan fitur mana yang semestinya berlaku untuknya. Karena itu, pengembangan fitur baru yang melibatkan nilai uang selalu diusahakan tetap bisa dikaitkan dengan sebuah akun dan tipenya — bukan berdiri sendiri lepas dari struktur ini.

## Disclaimer: ini rujukan konsep, bukan rulebook prosedural lengkap

Dokumen ini solid dipakai sebagai **rujukan** untuk menjawab pertanyaan mendasar: apa itu akun, apa fungsi tipe, dan apa bedanya tipe dengan status. Tapi dokumen ini **belum** — dan tidak diniatkan — menjawab semua pertanyaan prosedural secara kaku untuk tiap kemungkinan situasi di masa depan. Beberapa yang sudah disadari belum terjawab:

- Bagaimana kalau suatu akun perlu dikoreksi tipenya dalam jumlah besar sekaligus (bukan satu-dua akun), misalnya akibat impor data lama? Aturan "buat akun baru, pindahkan riwayat satu-satu" di atas terlalu berat kalau diterapkan apa adanya ke skala besar.
- Belum ada kriteria eksplisit untuk memutuskan "apakah kebutuhan baru ini cukup jadi **status** di tipe yang sudah ada, atau harus jadi **tipe akun baru**?" — keduanya masih diputuskan kasus per kasus lewat diskusi, bukan lewat aturan baku di dokumen ini.

**Karena itu**: setiap kali ada ide fitur atau tipe akun baru yang terasa tidak cocok persis dengan pola yang sudah dibahas di sini — termasuk kasus yang kelihatannya cuma "sedikit beda" — **wajib didiskusikan dulu** sebelum diimplementasikan, bukan dipaksa masuk ke salah satu kerangka yang sudah ada maupun langsung dibangun sebelum jelas statusnya (tipe baru/status baru/fitur turunan di atas struktur yang sudah ada). Insiden nyata yang memicu disclaimer ini: fitur "piutang/utang tanpa transaksi" sempat dibangun (`debts.account_id` dibiarkan kosong) SEBELUM dokumen ini ada — begitu konsepnya resmi dirumuskan, baru terlihat jelas kalau itu menyimpang dari prinsip "akun sebagai tumpuan". Disiplin mendiskusikan dulu akan menangkap penyimpangan seperti ini SEBELUM kode ditulis, bukan sesudahnya.

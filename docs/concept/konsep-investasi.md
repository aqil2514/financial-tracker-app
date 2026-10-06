# Konsep Investasi di Aplikasi Ini

> Status: BARU DISEPAKATI secara konsep (2026-10-06), BELUM diimplementasikan. Dicatat sebelum kode ditulis, sesuai disiplin "diskusikan dulu" di [konsep-tipe-akun.md](konsep-tipe-akun.md) bagian penutup. Model di dokumen ini adalah revisi total dari draf pertama (modal + nilai terkini sebagai dua angka manual) — draf pertama diganti total karena ternyata dibutuhkan juga pelacakan unit dan riwayat pembelian, bukan sekadar dua angka agregat.

## Satu akun investasi = satu instrumen, bukan portofolio gabungan

Tipe akun **Investasi** (`account_type = 'investment'`, lihat [konsep-tipe-akun.md](konsep-tipe-akun.md)) mengikuti aturan yang sama dengan semua tipe akun lain: **satu akun cuma boleh menyimpan satu hal** — di sini, satu instrumen investasi tunggal (misalnya satu akun untuk "Reksadana X", satu akun lain untuk "Saham Y"). Tidak boleh satu akun investasi menggabungkan nilai dari beberapa instrumen berbeda.

Kalau user ingin melihat total gabungan beberapa instrumen (mis. "total semua investasi saya"), itu BUKAN urusan tabel detail akun investasi — sudah ada tabel induknya: **`account_groups`** (pengelompokan bebas yang netral, sudah ada sejak awal). Pola ini identik dengan kasus yang sudah dibahas di [konsep-tipe-akun.md](konsep-tipe-akun.md) bagian "Grup akun untuk kasus campuran" (contoh e-wallet pribadi vs titipan) — sekarang diterapkan juga untuk investasi: tiap instrumen jadi akun sendiri, dikelompokkan lewat grup (mis. grup "Investasi" yang sudah ada sejak `0005_account_groups.sql`).

## Modal tetap dari saldo akun, seperti tipe lain

**Modal (cost basis)** — total uang yang ditanamkan ke instrumen ini — TIDAK disimpan sebagai kolom terpisah. Modal = `accounts.balance` akun ini, dihitung dari `initial_balance` + agregat transaksi transfer yang menyentuh akun ini, persis mekanisme tipe `cash` (lihat [konsep-transaksi.md](konsep-transaksi.md), "Transaksi adalah satu-satunya jalur sah mengubah saldo"). Menambah modal = transfer kas → akun investasi; menarik modal = transfer akun investasi → kas. Prinsip ini TIDAK berubah dari draf pertama.

## Unit dan harga per unit — riwayat pembelian otomatis dari transaksi transfer

Beda dari draf pertama, tipe Investasi di sini melacak **unit** (jumlah lembar/lot instrumen yang dipegang), bukan cuma nominal rupiah. Mekanismenya mengikuti pola yang sudah terbukti jalan di tipe Utang/Piutang — **satu transaksi transfer, lebih dari satu tabel ikut bergerak** (lihat `applyDebtTransaction`, dibahas di [konsep-utang-piutang.md](konsep-utang-piutang.md)):

- Setiap **transfer kas → akun investment WAJIB disertai 2 field tambahan**: jumlah unit yang dibeli, dan harga per unit saat itu. Field ini muncul di form transaksi HANYA ketika akun tujuan bertipe `investment` — sama seperti field `debtAction`/kontak yang cuma muncul untuk akun bertipe `debt`.
- Kedua field ini **manual, independen satu sama lain**, dan **TIDAK divalidasi** harus sama dengan nominal transfer (`unit × harga per unit` boleh berbeda dari nominal rupiah transfer — misal akibat pembulatan atau salah input). Modal (`accounts.balance`) tetap murni dari nominal transfer seperti biasa, tidak terpengaruh field unit/harga ini. Kalau user salah input unit/harga, perbaikannya lewat fitur edit transaksi yang sudah ada — TIDAK perlu validasi ketat di titik input, konsisten dengan filosofi aplikasi ini yang umumnya tidak menghakimi data di banyak tempat lain.
- Transaksi ini otomatis melahirkan satu baris di tabel riwayat baru (nama kerja: `investment_purchases`) — kolom inti: `account_id`, `transaction_id`, `unit`, `price_per_unit`, `date`, `status`. Analogi tepatnya dengan `debts`: transaksi transfer cash↔debt otomatis membuat/memutakhirkan baris `debts`; di sini, transaksi transfer cash→investment otomatis membuat baris riwayat pembelian.
- **Total unit yang dipegang akun ini TIDAK disimpan sebagai kolom** — selalu SUM dari `investment_purchases`, persis prinsip `accounts.balance` yang juga tidak pernah jadi kolom tersimpan, selalu dihitung ulang dari sumbernya.

### Settlement tertunda (`status`: `pending` → `settled`)

Instrumen seperti reksadana lazimnya tidak langsung "cair" jadi unit saat dana ditransfer — ada rentang waktu settlement (T+1/T+2/dst) sebelum harga/unit final dikonfirmasi. Pola ini ditangani DI DALAM baris `investment_purchases` itu sendiri lewat kolom `status` (`CHECK (status IN ('pending', 'settled'))`, default `'pending'`), BUKAN lewat transaksi/akun perantara terpisah — transaksi transfer kas tetap SATU kali seperti biasa, modal (`accounts.balance`) berkurang saat itu juga, persis mekanisme transfer normal.

**Catatan desain (2026-10-06)**: pendekatan "akun perantara" (lihat tipe `advance` yang sudah dipikirkan di [account-type.md](../apps/desktop/docs/todos/plan/account-type.md) — kas → akun advance saat beli, akun advance → akun investment saat settle, DUA transaksi terpisah) sebenarnya lebih akurat secara akuntansi, karena `accounts.balance` akun investment baru naik SETELAH settlement dikonfirmasi, bukan optimis duluan. Tapi tipe `advance` BELUM dibangun saat model ini dirumuskan, jadi pendekatan `status` di baris `investment_purchases` dipilih sebagai solusi SEMENTARA yang tidak butuh tipe akun lain. Ini BUKAN keputusan final yang menutup kemungkinan migrasi ke pola akun perantara nanti — kalau tipe `advance` sudah ada dan pendekatan sekarang terasa kurang, didiskusikan ulang.

- Saat baris baru dibuat dari transaksi transfer, `status = 'pending'` dan unit/harga per unit yang diisi adalah **estimasi** (angka yang diketahui user saat itu, bisa jadi beda dari NAV final).
- Begitu settlement benar-benar dikonfirmasi (beberapa hari kemudian), user **mengedit baris itu secara manual** — update unit/harga kalau berubah, dan ubah `status` jadi `'settled'`.
- **`total_unit` (dan karenanya nilai pasar terkini & Unrealized P/L) TETAP menghitung baris `pending`** — TIDAK menunggu status `settled` dulu. `accounts.balance` TIDAK berubah mekanismenya sama sekali (tetap murni dari `transactions` seperti semua tipe akun lain, prinsip di [konsep-transaksi.md](konsep-transaksi.md) TIDAK ada pengecualian untuk investment) — representasi "total = pending + settled" ini ada di `balance` secara otomatis karena transaksi transfer sudah tercatat sejak awal, bukan hasil SUM bersyarat baru.
- **Breakdown pending vs settled ditampilkan eksplisit** di halaman rincian investasi/laporan — tiga angka: total dana yang masih `pending`, total yang sudah `settled`, dan gabungan keduanya (= cermin `accounts.balance`). Ini murni presentasi untuk transparansi user, BUKAN mengubah cara hitung `balance`/`total_unit`.

## Nilai pasar terkini — satu-satunya field manual di level akun

> **Revisi 2026-10-06**: draf awal menyimpan `current_price_per_unit` (harga PER UNIT) di level akun, lalu nilai pasar dihitung `total_unit × current_price_per_unit`. Diganti jadi `current_market_value` (nilai pasar TOTAL langsung) karena user biasanya melihat "nilai portofolio saya sekarang Rp X" dari aplikasi investasi lain (reksadana/saham), bukan harga per unit — tidak perlu dipaksa menghitung/mengonversi ke per-unit dulu cuma untuk input manual. Harga per unit TETAP ada sebagai konsep, tapi turun ke level `investment_purchases` (lihat bagian di atas) sebagai snapshot historis harga BELI per lot, bukan sumber hitung nilai pasar terkini lagi.

Tabel detail `investment_accounts` (1:1 dengan `accounts`, pola yang sama dengan rencana `credit_accounts` di [account-type.md](../apps/desktop/docs/todos/plan/account-type.md)) menyimpan:

- **`unit_label`** — satuan tampilan (mis. "lembar", "unit", "gram"), murni kosmetik untuk UI.
- **`current_market_value`** — nilai pasar TOTAL instrumen ini SAAT INI, **manual**, diupdate user kapan saja (BUKAN ditarik otomatis dari API harga pasar, BUKAN dihitung dari unit × harga). Ini satu-satunya angka yang perlu diupdate manual secara berkala di level akun — beda dari riwayat pembelian yang cuma dicatat sekali saat transaksi terjadi.

Dari sini, satu angka turunan dihitung SELALU saat ditampilkan (tidak disimpan):

- **Unrealized P/L** (laba/rugi belum terealisasi, sudah disebut sebagai fitur turunan tipe Investasi di [konsep-tipe-akun.md](konsep-tipe-akun.md) bagian "Konsekuensi tipe") = `current_market_value − modal (accounts.balance)`, ditampilkan nominal DAN persentase (`current_market_value / modal − 1`).

### Persentase P/L: "return posisi aktif", bukan return total historis

Persentase yang ditampilkan ini SELALU berbasis **posisi yang sedang dipegang saat ini** (`balance` saat ini sebagai pembagi) — BUKAN return total sejak awal investasi kalau pernah ada penarikan/penjualan sebagian sebelumnya. Begitu sebagian unit ditarik, `balance` otomatis mengecil (mengikuti transaksi transfer keluar), dan persentase berikutnya dihitung dari modal yang TERSISA saja — untung/rugi dari unit yang sudah ditarik TIDAK ikut tercermin di angka ini.

Ini SENGAJA, bukan bug: menghitung return total historis yang akurat butuh melacak realized gain/loss (lihat "Pertanyaan terbuka" di bawah) — belum ada konsepnya di model ini. Konsekuensi praktis: kalau user membandingkan angka persentase ini dengan aplikasi investasi lain (mis. Retailku) yang pernah mencatat transaksi jual sebagian, angkanya BISA BERBEDA — bukan berarti salah satu keliru, cuma metode hitungnya beda (posisi aktif saja vs total historis termasuk yang sudah dicairkan).

## Update nilai pasar terkini TIDAK mengubah saldo akun

Ini titik paling penting yang membedakan Investasi dari pola "transaksi penutup" yang sudah ada di tipe lain (Koreksi Saldo, write-off piutang — lihat [konsep-transaksi.md](konsep-transaksi.md)):

- Update `current_market_value` **TIDAK** membuat transaksi `income`/`expense` apa pun, dan **TIDAK** mengubah `accounts.balance` sama sekali.
- `accounts.balance` akun investasi SELALU murni cermin uang yang benar-benar ditanam/ditarik lewat transaksi riil — sama seperti tipe `cash`, tidak ada pengecualian.
- Nilai pasar terkini dan Unrealized P/L murni angka turunan INFORMASIONAL yang hidup berdampingan dengan saldo, bukan menggantikannya.

**Kenapa ini BEDA dari pola transaksi penutup** (yang mewajibkan setiap perubahan nilai "dipegang" akun lewat transaksi, lihat [konsep-transaksi.md](konsep-transaksi.md) bagian "Implikasi untuk fitur baru"): kriteria "apakah ini mengubah nilai yang dipegang akun" di situ dipenuhi oleh dua ciri yang SELALU hadir bersamaan di kasus existing (piutang diikhlaskan, Koreksi Saldo) — (1) yang "dipegang" akun berubah SECARA LITERAL (unit/hak tagihnya sendiri, bukan cuma ekspektasi nilainya), dan (2) peristiwanya FINAL/tidak bisa berbalik lagi (begitu diikhlaskan atau dikoreksi, tidak ada "besok nilainya balik seperti semula").

Update harga pasar investasi GAGAL kedua ciri ini sekaligus:

- **Yang "dipegang" akun investment TETAP sama** — jumlah unit dan modal (`accounts.balance`) tidak berubah sama sekali saat harga naik/turun. Analoginya: akun saham tidak "kehilangan lembar saham" saat harganya turun, cuma nilai pasarnya yang turun. Beda dari piutang yang memang hak tagihnya sendiri (bukan cuma "harga"-nya) yang hilang saat diikhlaskan.
- **Peristiwanya BELUM final** — harga bisa naik lagi besok, rugi/untungnya baru benar-benar "terjadi" (tidak bisa berbalik lagi) saat instrumen itu benar-benar dijual. Beda dari Koreksi Saldo yang mengakui kejadian uang riil yang SUDAH terjadi (cuma belum tercatat) — update harga investasi murni ekspektasi yang masih mengambang (*floating*), belum ada apa pun yang benar-benar terealisasi/berpindah.

Unrealized P/L, sesuai namanya, memang belum final — baru jadi peristiwa riil (dan baru lewat transaksi) saat instrumen itu benar-benar dicairkan/dijual.

## Laporan/agregat total kekayaan tetap berbasis modal, bukan nilai pasar

Supaya konsisten dengan prinsip "laporan menampilkan angka apa adanya" ([konsep-tipe-akun.md](konsep-tipe-akun.md)) dan tidak diam-diam mencampur dua basis penilaian berbeda, agregat total kekayaan (dashboard, laporan Per Tipe Akun, dst) TETAP menjumlah `accounts.balance` untuk SEMUA tipe akun termasuk Investasi — bukan nilai pasar terkini. Nilai pasar terkini dan Unrealized P/L ditampilkan sebagai info tambahan di samping (misalnya di detail akun atau kartu ringkasan investasi), bukan ikut masuk ke angka SUM total.

## Pertanyaan terbuka: penjualan/penarikan sebagian

Begitu ada riwayat pembelian per-lot (unit + harga beli masing-masing), penarikan sebagian dari akun investasi (transfer investment → kas) memunculkan pertanyaan akuntansi yang SENGAJA belum dijawab di dokumen ini:

- Unit mana yang dianggap "terjual" saat penarikan sebagian — FIFO (lot tertua duluan, pola yang sudah dipakai pelunasan piutang di [konsep-utang-piutang.md](konsep-utang-piutang.md)), rata-rata harga beli (average cost), atau dipilih manual oleh user?
- Apakah penarikan sebagian ini perlu mencatat **realized gain/loss** (selisih harga jual vs harga beli lot yang terjual) sebagai informasi terpisah dari Unrealized P/L di atas?
- Apakah penarikan sebagian WAJIB juga mengisi field unit+harga (simetris dengan pembelian), atau boleh berbeda perlakuan?

Ini BUKAN diputuskan "tidak penting" — sekadar ditunda sampai modal pembelian (bagian di atas) terbukti cukup lewat pemakaian nyata, sebelum menambah lapisan kompleksitas lebih jauh. Didiskusikan dulu sebelum diimplementasikan, sesuai disiplin yang digariskan di [konsep-tipe-akun.md](konsep-tipe-akun.md) bagian penutup.

## Yang SENGAJA belum didukung

- **Harga pasar otomatis** (API/live price) — `current_market_value` murni manual, tidak ada integrasi harga real-time.
- **FIFO/average cost saat penjualan, dan realized gain/loss** — lihat "Pertanyaan terbuka" di atas.
- **Validasi unit × harga vs nominal transfer** — sengaja tidak divalidasi, lihat bagian "Unit dan harga per unit" di atas.

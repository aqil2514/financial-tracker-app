# Konsep Investasi di Aplikasi Ini

> Status: pencatatan pembelian (modal, unit, harga per unit, settlement, nilai pasar manual, Unrealized P/L) SUDAH diimplementasikan dan lolos smoke test manual. Bagian "Penjualan/penarikan sebagian" di bawah SUDAH diimplementasikan lengkap (logic + form + UI riwayat + aksi Settle/Hapus untuk baris pending, 2026-10-07, lihat [apps/desktop/docs/todos/plan/account-type-investment.md](../apps/desktop/docs/todos/plan/account-type-investment.md) catatan teknis) — termasuk revisi "Dana BARU cair saat settled" (lihat bagian itu di bawah). BELUM diuji manual lengkap di `tauri dev` untuk alur settle. Model di dokumen ini adalah revisi total dari draf pertama (modal + nilai terkini sebagai dua angka manual) — draf pertama diganti total karena ternyata dibutuhkan juga pelacakan unit dan riwayat pembelian, bukan sekadar dua angka agregat. **Gap ditemukan 2026-10-08, KEDUA arah sudah diimplementasikan sama sesi** (`tsc --noEmit` bersih, 212 test vitest lulus; BELUM diuji manual di `tauri dev`): unit yang berubah tanpa transfer kas (hibah masuk/keluar, bonus saham, right issue/warrant, write-off/delisting, unit yang sudah dipegang sebelum pakai app) — lihat bagian "Unit yang berubah TANPA transfer kas" di bawah.

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

## Penjualan/penarikan sebagian (disepakati 2026-10-06, BELUM diimplementasikan)

Setelah modal pembelian terbukti cukup lewat pemakaian nyata (smoke test, tanpa bug ditemukan), pertanyaan yang sebelumnya ditunda di bawah ini sudah dijawab secara konsep. Belum ada satu baris kode pun untuk bagian ini — dicatat dulu sebelum implementasi, sesuai disiplin "diskusikan dulu" di [konsep-tipe-akun.md](konsep-tipe-akun.md) bagian penutup.

### Cost basis: average cost, bukan FIFO atau manual

Unit yang "terjual" saat penarikan sebagian dihitung berbasis **average cost**, BUKAN FIFO (lot tertua duluan) dan BUKAN pemilihan lot manual oleh user. Average cost per unit = `SUM(unit × price_per_unit) / SUM(unit)` dari seluruh baris `investment_purchases` berstatus `settled` milik akun ini — satu angka rata-rata yang dipakai untuk SEMUA unit yang dijual, tidak peduli dari transaksi beli mana asalnya.

Alasan memilih average cost: instrumen yang realistis dicatat di aplikasi ini (reksadana, saham, emas, kripto) pada praktiknya memang dilacak dengan average cost oleh platform/broker aslinya (mis. aplikasi reksadana, sekuritas lokal) — bukan per-lot seperti yang dibutuhkan untuk pelaporan pajak capital gain di beberapa negara lain. FIFO yang sudah dipakai untuk pelunasan piutang ([konsep-utang-piutang.md](konsep-utang-piutang.md)) TIDAK dipakai di sini karena konteksnya berbeda — piutang per kontak punya identitas transaksi yang jelas harus dilunasi urut, sedangkan unit investasi fungible (satu lembar saham X tidak bisa dibedakan dari lembar saham X lainnya yang dibeli di harga berbeda).

### Realized gain/loss dicatat sebagai info terpisah dari Unrealized P/L

Begitu penjualan benar-benar **settled**, dihitung dan disimpan **Realized P/L**:

```
realized_pl = (harga_jual_per_unit − average_cost_per_unit_saat_itu) × unit_terjual
```

Ini angka yang SUDAH final/tidak mengambang lagi (beda dari Unrealized P/L yang masih bisa berubah tiap update `current_market_value`) — ditampilkan di riwayat transaksi/pembelian sebagai info tambahan per baris jual, TIDAK ikut campur ke hitungan Unrealized P/L akun yang masih berjalan (Unrealized P/L tetap murni `current_market_value − balance` yang tersisa, lihat bagian di atas).

**Revisi 2026-10-07 — belum ditulis sampai settled**: `realized_pl` dan `average_cost_per_unit` TIDAK dihitung/disimpan sejak baris penjualan dibuat (`status: 'pending'`) — keduanya `NULL` selama masih pending, baru dihitung dari kondisi average cost SAAT settle terjadi. Alasan: average cost bisa masih bergeser kalau ada pembelian baru di antara create dan settle, dan Realized P/L secara definisi belum final sampai dana benar-benar cair — menyimpannya sejak pending berarti menyajikan angka yang masih bisa berubah sebagai kalau sudah pasti. Lihat juga bagian "Dana BARU cair saat settled" di bawah untuk alasan terkait (kenapa `pending` juga tidak membuat transaksi apa pun).

### Input jual: unit + harga jual per unit, simetris dengan beli

Form jual investasi (investment → cash) butuh field yang SAMA dengan form beli: jumlah unit yang dijual, dan harga jual per unit saat itu (termasuk toggle Satuan/Total yang sudah ada di form beli). Nominal transaksi (uang masuk ke kas) = `unit × harga_jual_per_unit`, dihitung otomatis seperti pola beli.

### Efek ke `accounts.balance`: average cost, bukan nominal uang yang diterima

Ini titik paling krusial yang membedakan jual dari transaksi transfer biasa — `accounts.balance` akun investasi dikurangi sebesar:

```
pengurangan_balance = average_cost_per_unit × unit_terjual
```

**BUKAN** sebesar nominal uang yang benar-benar diterima dari penjualan. Selisih antara nominal jual dan pengurangan balance inilah yang jadi Realized P/L di atas. Ini konsisten dengan prinsip "`balance` = modal murni dari kas" (bagian "Modal tetap dari saldo akun" di atas) — kalau balance dikurangi sebesar nominal jual (yang sudah termasuk untung/rugi), balance jadi tercampur dua basis (modal + P/L), persis masalah yang sudah dihindari untuk `current_market_value`.

Konsekuensi: `accounts.balance` TIDAK bisa dikurangi langsung dari nominal transaksi seperti transfer biasa — perlu logic khusus (mirip `applyInvestmentTransaction` untuk arah beli) yang menghitung average cost dulu, lalu mengurangi balance sebesar `average_cost × unit`, BUKAN sebesar nominal transfer. Nominal transfer tetap yang masuk ke `transactions` (untuk cashflow/laporan transaksi biasa), tapi efeknya ke `accounts.balance` akun investasi berbeda dari nominal itu sendiri — pola baru yang belum ada presedennya di tipe akun lain.

### Validasi: cegah oversell

Jual yang melebihi total unit yang dimiliki harus ditolak di titik input — berbeda dari filosofi "tidak menghakimi data" yang dipakai untuk unit/harga saat beli (lihat bagian "Unit dan harga per unit" di atas), karena oversell di sini bukan cuma estimasi yang boleh beda dari realita, tapi representasi matematis yang tidak mungkin valid (tidak bisa menjual lebih dari yang dipegang). "Total unit yang dimiliki" di sini bukan `SUM(unit)` murni dari `investment_purchases` — lihat rumus persis di "Keputusan implementasi" di bawah.

### Dana BARU cair saat settled (revisi 2026-10-07)

Draf pertama implementasi (lihat "Keputusan implementasi" di bawah) men-treat penjualan sama persis seperti pembelian: unit dikurangi optimis, DAN transaksi transfer ke kas langsung dibuat begitu baris dibuat — terlepas dari status `pending`/`settled`. Ternyata ini SALAH arah secara riil: untuk pembelian, uang memang sudah keluar dari kas duluan saat order dibuat (user sudah bayar), unit-nya yang belum pasti — jadi "kas berkurang langsung" itu akurat. Untuk **penjualan**, yang terjadi lebih dulu secara riil adalah **unit berkurang** (order jual sudah diajukan), BUKAN dana masuk kas — dana baru benar-benar bisa dipakai setelah settlement dikonfirmasi (reksadana T+1/T+2, saham T+2). Kalau kas langsung bertambah saat masih pending, user bisa "memakai" uang yang secara riil belum ada di tangannya.

**Perbaikan**:

- **Status `pending`**: HANYA baris `investment_sales` yang dibuat (unit & harga jual yang diminta/diestimasi). **TIDAK ADA baris `transactions` yang dibuat sama sekali** — kas benar-benar belum tersentuh. Unit TETAP berkurang dari holding secara optimis seperti sebelumnya (rumus "sisa unit" di bawah tidak berubah).
- **Status `settled`**: baru di titik inilah transaksi transfer (`average_cost × unit`) + transaksi penyesuaian Realized P/L dibuat, dan `average_cost_per_unit`/`realized_pl` dihitung & disimpan permanen (lihat revisi di bagian "Realized gain/loss" di atas).
- **Aksi "Settle"**: baris pending yang sudah ada disettle lewat aksi terpisah (tombol "Settle" di riwayat penjualan) yang meminta user memilih akun kas tujuan saat itu — `investment_sales` TIDAK menyimpan akun kas tujuan sejak create, karena belum ada transaksi/akun kas yang terlibat selama masih pending.
- **Form transaksi utama HANYA mendukung jual `settled` langsung** — form itu secara arsitektur SELALU insert satu baris `transactions` begitu disubmit (dipakai bersama semua tipe transaksi), yang kontradiktif dengan "pending tidak boleh insert apa pun". Status `pending` untuk jual HANYA lewat dialog "Jual Investasi" khusus (yang tidak selalu insert transaksi).
- Konsekuensi UX yang disengaja (ditunda): belum ada mekanisme umum "menu aksi per-baris untuk settle" yang berlaku lintas fitur (bukan cuma investasi) — untuk sekarang, cukup tombol dedicated di tabel riwayat penjualan.

### Keputusan implementasi (2026-10-07)

Diputuskan sebelum kode ditulis (bukan diasumsikan), menjawab 3 pertanyaan yang sebelumnya terbuka di sini — detail teknis lengkap ada di [apps/desktop/docs/todos/plan/account-type-investment.md](../apps/desktop/docs/todos/plan/account-type-investment.md) catatan teknis "Penjualan/penarikan sebagian":

- **Skema**: tabel baru `investment_sales` (bukan kolom negatif di `investment_purchases`, bukan field `realized_pl` ditambahkan ke tabel yang sudah ada) — kolom `account_id`, `transaction_id`, `adjustment_transaction_id` (lihat poin balance di bawah), `unit`, `price_per_unit`, `average_cost_per_unit`, `realized_pl`, `date`, `status`.
- **`classifyAccountPair` dapat varian baru `investment-cash`** (arah jual), di samping `cash-investment` (arah beli) yang sudah ada. Dikonfirmasi `apps/worker` TIDAK ikut jalur sync investment sama sekali (desktop-only) — tidak perlu perubahan di Worker.
- **Unit dikurangi dari holding secara OPTIMIS** begitu baris `investment_sales` dibuat dengan status `pending` — simetris dengan pembelian (penjualan realitanya juga tidak selalu instan, mis. reksadana T+1/T+2), BUKAN menunggu status `settled` dulu.
- **"Total unit yang dimiliki" (basis oversell-check + average cost) punya rumus KHUSUS**, beda dari `total_unit` yang dipakai Unrealized P/L (yang mengikutkan pending+settled, lihat "Settlement tertunda" di atas): `SUM(unit, investment_purchases WHERE status='settled') − SUM(unit, investment_sales WHERE status IN ('pending','settled'))`. Pembelian yang masih pending TIDAK ikut dihitung sebagai unit yang bisa dijual.
- **UI breakdown "unit tersisa" + average cost** ditampilkan di form jual via `useInvestmentHoldingSummary` (query baru).
- **Efek ke balance via 2 transaksi** (bukan 1): karena `accounts.balance` live-computed dari `SUM(transactions.amount)` dan satu baris transfer cuma punya satu kolom `amount` untuk kedua sisi, balance investment (`average_cost × unit`) dan nominal jual penuh yang diterima kas tidak bisa direpresentasikan dalam satu baris. Leg transfer utama = `average_cost × unit`; leg kedua (`income`/`expense` di akun kas, dibuat otomatis) = selisih Realized P/L. Konsekuensi yang diterima: Realized P/L ikut masuk ke laporan cashflow Pemasukan/Pengeluaran biasa (bukan murni informasional). Link ke leg kedua via FK eksplisit `adjustment_transaction_id`.

## Unit yang berubah TANPA transfer kas (hibah, bonus saham, right issue/warrant, airdrop, write-off) — GAP, belum diimplementasikan

Ditemukan 2026-10-08 lewat diskusi (bukan dogfooding) saat menelusuri kenapa belum ada tempat mencatat "unit awal" untuk instrumen yang sudah dipegang user SEBELUM pakai app. Model "Unit dan harga per unit" di atas mengasumsikan SETIAP unit lahir/hilang dari transfer kas ↔ investment (`applyInvestmentTransaction`/`applySellInvestmentTransaction` hanya trigger kalau `type === 'transfer'`) — asumsi ini valid untuk pembelian/penjualan riil, tapi GAGAL untuk kasus di mana unit berubah tanpa ada kas yang berpindah sama sekali. Ada DUA arah, keduanya gap, dan keduanya BUKAN simetris satu sama lain secara model data (lihat alasan di masing-masing poin):

### Arah bertambah: unit masuk gratis

Instrumen dihibahkan orang lain, bonus saham, right issue/warrant yang dieksekusi tanpa modal tambahan, airdrop kripto, atau sekadar unit yang sudah dipegang sebelum mulai mencatat di app ini. Memaksa kasus ini lewat transfer kas (modal dibuat 0 atau dipalsukan) tidak akurat secara akuntansi — tidak ada kas yang benar-benar berpindah.

**Sekaligus jawaban untuk "saldo & unit awal sebelum pakai app"** (pertanyaan yang memulai diskusi gap ini): mekanisme `record_mode: 'direct'` di bawah TIDAK PERLU akun kas apa pun sebagai sumber — `initial_balance` akun investment tetap `0` seperti biasa, lalu satu baris "Catat Pembelian" mode `direct` dengan `amount` = nilai modal yang mau diakui (boleh sembarang angka taksiran, atau 0 kalau memang tidak ada modal yang mau diakui) sekaligus `unit`/`price_per_unit` sesuai kondisi riil saat itu. Lebih akurat dari opsi "transfer dari akun kas dummy" yang sempat dipertimbangkan di awal diskusi — opsi itu memerlukan akun kas sumber fiktif padahal tidak ada kas yang benar-benar berpindah; `direct` sama sekali tidak menyentuh kas.

**Rujukan pola yang SUDAH ada untuk masalah serupa**: tipe akun Utang/Piutang punya `create_debt_direct` (lihat `apps/mcp-server/src/lib/mcp-tools/debts/create-debt-direct.ts` dan Worker `createDirectDebt` di `apps/worker/src/modules/debts/service.ts`) — piutang/utang baru yang lahir "tanpa transaksi kas apa pun" (pinjam tunai, barter, piutang lama). Kuncinya: ini TETAP membuat satu baris `transactions`, tapi `income`/`expense` (menyentuh SATU akun saja — akun debt itu sendiri), BUKAN `transfer` (dua akun) — prinsip "`accounts.balance` hanya boleh berubah lewat `transactions`" ([konsep-transaksi.md](konsep-transaksi.md)) tetap dipegang, cuma jenis transaksinya beda. Baris `debts` di-insert LANGSUNG oleh `createDirectDebt`, independen dari `applyDebtTransaction` (yang hanya trigger dari transfer) — bukan lewat jalur form transaksi utama. `createDirectDebt` MENCIPTAKAN nilai baru: `receivable` → `income` (+), `payable` → `expense` (−), pada akun debt itu sendiri.

**DIIMPLEMENTASIKAN 2026-10-08** (lihat [apps/desktop/docs/todos/plan/account-type-investment.md](../apps/desktop/docs/todos/plan/account-type-investment.md) untuk detail file/fungsi — `tsc --noEmit` bersih, 212 test vitest lulus, BELUM diuji manual di `tauri dev`):

- Field `record_mode: "transfer" | "direct"` ditambahkan ke form "Catat Pembelian" yang sudah ada (`shared/investments/new-purchase-form/`), BUKAN dialog terpisah — pola PERSIS `record_mode` di `shared/debts/new-debt-form/`. Mode `direct` membuat transaksi `income` ke akun investment itu sendiri (nominal 0 untuk hibah murni tanpa nilai taksiran, atau nilai taksiran tertentu untuk bonus saham/right issue yang ingin diakui sebagai modal — SEKALIGUS cara mencatat saldo & unit awal sebelum pakai app, lihat bagian "Sekaligus jawaban..." di atas), LALU insert baris `investment_purchases` langsung dengan `unit`/`price_per_unit` manual — TIDAK lewat `applyInvestmentTransaction` (yang tetap exclusive untuk jalur transfer kas→investment biasa), sama seperti `createDirectDebt` insert `debts` langsung tanpa lewat `applyDebtTransaction`.
- **Pertanyaan yang sempat terbuka — DIJAWAB: `price_per_unit` WAJIB diisi** untuk `record_mode: 'direct'` (bukan boleh 0) — supaya `getAverageCostPerUnit()` tidak "mengencerkan" average cost unit yang dibeli riil. `status` dipaksa `'settled'` (tidak ada konsep pending untuk hibah/bonus yang sudah diterima).
- **Pembeda lot hibah/bonus vs beli riil — DIPUTUSKAN: derive, TIDAK ada kolom `source` baru.** Cukup JOIN `investment_purchases.transaction_id` → `transactions.type` (`income` = direct, `transfer` = beli riil).

### Arah berkurang: unit hilang/dilepas tanpa kas masuk — BUKAN domain `applySellInvestmentTransaction`

Instrumen dihibahkan KE orang lain, delisting/perusahaan bangkrut (unit jadi tidak bernilai), biaya administrasi yang dipotong dalam bentuk unit (bukan dari kas), atau fraksi unit yang hilang akibat corporate action (reverse split, dst). Ini TIDAK sama dengan "jual tanpa kas" — jalur jual yang sudah ada (`applySellInvestmentTransaction`, lihat bagian "Penjualan/penarikan sebagian" di atas) secara model data MEWAJIBKAN ada kas yang diterima (`average_cost × unit` dikurangi dari balance, nominal jual penuh masuk ke kas via leg kedua) — memaksa unit yang hilang tanpa kas lewat jalur ini berarti mencatat kas masuk palsu.

**Rujukan pola yang SUDAH ada untuk masalah serupa**: `write_off_debt`/`writeOffDebt` (lihat Worker `apps/worker/src/modules/debts/service.ts`) — piutang/utang yang "diikhlaskan" (status `written_off`, BUKAN pelunasan). Ini KEBALIKAN arah dari `createDirectDebt`: transaksi closing (`income`/`expense`, arah berlawanan dari create) dibuat sebesar SISA saldo, membawa balance akun debt ke nol — bukan menciptakan nilai baru, tapi menghapuskan nilai yang sudah ada.

**DIIMPLEMENTASIKAN 2026-10-08** (fungsi baru `applyWriteOffInvestmentTransaction`, `shared/investments/apply-write-off-investment-transaction.ts` — lihat [apps/desktop/docs/todos/plan/account-type-investment.md](../apps/desktop/docs/todos/plan/account-type-investment.md) untuk detail file/fungsi lengkap). Kedua pertanyaan struktural yang sempat terbuka DIJAWAB (ditanya eksplisit ke user sebelum kode ditulis):

- **Mekanisme — DIPUTUSKAN: baris `investment_sales` baru** (BUKAN unit negatif di `investment_purchases` — supaya `getAverageCostPerUnit()` tidak tercemar unit negatif berharga sembarang). `price_per_unit = 0`, `adjustment_transaction_id = NULL` (TIDAK ada leg kedua ke akun kas, beda dari jual), `status` selalu `'settled'`. Satu transaksi `expense` dibuat LANGSUNG pada akun investment itu sendiri (pola `write_off_debt`, bukan `applySellInvestmentTransaction` yang mewajibkan akun kas tujuan).
- **Nominal rupiah yang diakui sebagai kerugian — DIPUTUSKAN: `averageCost × unit`**, dihitung otomatis dari `getAverageCostPerUnit()` (BUKAN nominal manual bebas user) — konsisten dengan nominal yang dipakai jual, supaya Realized P/L (`= -averageCost × unit`, selalu kerugian penuh) tetap akurat terhadap average cost gabungan. User cukup input unit yang hilang, tidak perlu input rupiah sama sekali.
- UI: dialog "Write-off Unit" baru (`shared/investments/write-off-investment-form/`), tombol di header `/investments/detail` di sebelah "Jual Investasi". Baris write-off tampil otomatis di `SalesHistoryTable` yang sudah ada (harga jual `Rp 0`, Realized P/L merah) tanpa perlu kode tambahan.

### Bug ditemukan lewat dogfooding (2026-10-08): edit transaksi direct/write-off lewat form transaksi utama menghapus baris turunan tanpa pengganti

Ditemukan nyata (bukan diskusi) saat user mencatat "Saldo Awal" investasi via `record_mode: 'direct'`, lalu mengoreksi nominalnya lewat edit transaksi di form UTAMA (bukan dialog dedicated) — baris `investment_purchases` pasangannya hilang permanen tanpa pengganti.

**Root cause**: `applyInvestmentTransactionEdit` (dipanggil `use-update-transaction.ts` untuk SEMUA transaksi income/expense/transfer yang menyentuh akun investment, kecuali arah jual) selalu menghapus baris `investment_purchases` lama lalu memanggil `applyInvestmentTransaction` untuk membuat baris baru — tapi fungsi itu `return none` (no-op) untuk `type !== 'transfer'`. Transaksi hasil `record_mode: 'direct'` TETAP `type: 'income'` (tidak pernah jadi `transfer`) saat diedit, jadi baris lama terhapus tanpa pengganti sama sekali. Gap yang SAMA berlaku untuk write-off (`investment_sales`, `type: 'expense'`) — sebelumnya malah salah jatuh ke cabang `applyInvestmentTransactionEdit` (tabel yang salah, `investment_purchases` bukan `investment_sales`) karena tidak ada deteksi khusus write-off di `use-update-transaction.ts`.

**Perbaikan (2026-10-08)**:

- `applyInvestmentTransactionEdit` (`apply-investment-transaction.ts`): begitu baris lama ada DAN `type` baru BUKAN `'transfer'`, UPDATE in-place (`unit`/`price_per_unit`/`date`) — TIDAK delete+recreate. Delete+recreate lewat `applyInvestmentTransaction` tetap jalur yang benar HANYA untuk `type === 'transfer'` (pola lama, tidak berubah).
- Fungsi baru `applyWriteOffInvestmentTransactionEdit` + `getTransactionWriteOff` (`apply-write-off-investment-transaction.ts`): deteksi write-off lewat `investment_sales.price_per_unit = 0` (BUKAN `adjustment_transaction_id IS NULL` saja — itu juga bisa true untuk jual biasa yang kebetulan `realizedPl == 0`), UPDATE in-place baris yang sama, `amount`/`realized_pl` dihitung ULANG dari `averageCost × unit` saat ini (sama prinsip dengan jual — bukan nilai bebas dari form).
- `use-update-transaction.ts`: cabang baru `isWriteOff` (dicek via `getTransactionWriteOff`) ditambahkan SEBELUM fallback ke `applyInvestmentTransactionEdit`, sejajar dengan `isInvestmentSell` yang sudah ada.
- **Scope yang SENGAJA tidak diubah**: field `unit`/`price_per_unit` masih TIDAK muncul di form transaksi utama untuk transaksi income/expense pada akun investment (`needsInvestmentFields` di `use-transaction-investment-fields.ts` tetap exclusive untuk `type === 'transfer'`) — user belum bisa mengoreksi `unit` dari form ini, cuma `amount`/`note`/`date` yang efektif bisa diedit (dan `amount` untuk write-off tetap dihitung otomatis, bukan dari input). Koreksi `unit`/`price_per_unit` untuk direct-purchase tetap lewat `shared/investments/edit-purchase-form/` (dialog dedicated yang sudah ada); write-off belum punya dialog edit dedicated serupa.
- Test baru: `apply-investment-transaction.test.ts` (kasus `type: 'income'` pada `applyInvestmentTransactionEdit`), `apply-write-off-investment-transaction.test.ts` (`applyWriteOffInvestmentTransactionEdit` + `getTransactionWriteOff`, termasuk kasus negatif "jual biasa tidak boleh salah kena deteksi write-off"). `tsc --noEmit` bersih, 218 test vitest lulus. BELUM diuji manual di `tauri dev`.
- **Data production yang sempat korup akibat bug ini sudah diperbaiki manual** (insert ulang baris `investment_purchases` yang hilang + push ke D1) — lihat riwayat chat 2026-10-08, bukan via migrasi (data existing, bukan skema).

## Yang SENGAJA belum didukung

- **Harga pasar otomatis** (API/live price) — `current_market_value` murni manual, tidak ada integrasi harga real-time.
- **Validasi unit × harga vs nominal transfer SAAT BELI** — sengaja tidak divalidasi, lihat bagian "Unit dan harga per unit" di atas (beli tetap longgar, beda dari jual yang divalidasi cegah oversell).

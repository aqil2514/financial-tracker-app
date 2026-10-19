# Koreksi Saldo: Konsistensi Data Turunan per Tipe Akun

## Status & TODO saat ini (ringkas)

Penjelasan lengkap tiap poin ada di bagian "Latar belakang" di bawah — BACA DULU, terutama "Kenapa Investasi lebih rumit dari Utang/Piutang", "Hubungan dengan cash-neutral-transaction-flag.md", dan "Validasi konsistensi pasca-koreksi".

- [x] Gap dikonfirmasi nyata untuk tipe Investasi (2026-10-16), bukan cuma potensi seperti disebut `konsep-tipe-akun.md`.
- [x] Dependency ke `cash-neutral-transaction-flag.md` diluruskan (2026-10-16) — toggle cashflow akun Kas BLOCKED BY migrasi kolom `is_cash_neutral` di dokumen itu, lihat "Hubungan dengan cash-neutral-transaction-flag.md".
- [x] Selesaikan [cash-neutral-transaction-flag.md](../done/cash-neutral-transaction-flag.md) (2026-10-19) — blocker untuk toggle cashflow akun Kas SELESAI (migrasi kolom + sync D1 + MCP), lihat dokumen itu. Toggle akun Kas (butir 7 di bawah) ikut diimplementasikan BERSAMAAN saat mengerjakan dokumen itu (field `countAsCash` + `FieldCountAsCash` + `resolveIsCashNeutral` di `use-correct-account-balance.ts`) — lihat butir 7 di bawah utk detail.
- [x] Keputusan UX koreksi saldo akun Kas diambil (2026-10-16) — tidak ada masalah konsistensi data turunan (tidak ada tabel turunan untuk tipe ini), cukup toggle cashflow dari `cash-neutral-transaction-flag.md` (blocked, lihat item di atas).
- [x] Arah solusi Utang/Piutang disepakati (2026-10-16) — jalur granular per kontak (pilih baris `debts` dulu, baru input nominal seharusnya), lihat "Konsep jalur koreksi granular". Implementasi belum mulai.
- [x] Guard validasi pasca-koreksi diputuskan (2026-10-16) — hitung ulang `accounts.balance` vs agregasi data turunan setelah tiap koreksi granular, ROLLBACK seluruh mutation kalau tidak cocok, lihat "Validasi konsistensi pasca-koreksi".
- [x] Fitur "Cek Konsistensi" manual disepakati masuk scope (2026-10-16) — deteksi drift dari sumber lain (bug lama, migrasi, sisa Koreksi Saldo generik sebelum guard ada), read-only, lihat "Validasi konsistensi pasca-koreksi".
- [ ] Detail bentuk form Investasi belum didesain — arah konsepnya sama (granular, bukan satu nominal), tapi field persisnya (unit/harga) belum diputuskan, lihat "Kenapa Investasi lebih rumit dari Utang/Piutang".
- [ ] Audit akun Dana Pihak Ketiga belum dilakukan — belum dicek apakah `third_party_funds` punya masalah serupa.
- [x] TEMUAN (2026-10-16): worker/MCP SUDAH punya guard tolak-total untuk `debt`+`investment` (`isAccountTypeRestrictedFromDirectTransaction`), desktop BELUM — lihat "TEMUAN PENTING" di bawah, desktop jadi prioritas segera.
- [ ] Guard sementara (tolak total, meniru worker) BELUM ditambahkan di desktop — paling urgent, lihat "Pekerjaan yang MASIH KOSONG" butir 1.
- [ ] Implementasi jalur granular (solusi akhir, lebih permisif dari tolak total) belum mulai.

## Latar belakang

Dipisahkan (2026-10-16) dari [cash-neutral-transaction-flag.md](../done/cash-neutral-transaction-flag.md) (SELESAI, dipindah ke `done/`) — awalnya dibahas bersamaan karena sama-sama nyambung ke `use-correct-account-balance.ts`, tapi ini masalah yang BERBEDA AKAR dan BERBEDA SOLUSI dari flag `is_cash_neutral`, jadi dipisah supaya tidak tercampur saat implementasi.

Perbedaannya: `is_cash_neutral` cuma menjawab "transaksi ini tampil di laporan Pendapatan/Pengeluaran atau tidak?" — tidak menyentuh `accounts.balance` sama sekali. Dokumen INI menjawab pertanyaan yang beda total: "kalau Koreksi Saldo dipakai di akun non-cash, bagaimana caranya data turunan (`debts`, `investment_purchases`, dst) ikut disesuaikan supaya tidak timpang dengan saldo barunya?"

### Hubungan dengan `cash-neutral-transaction-flag.md` — BLOCKED BY, bukan independen

Koreksi dari diskusi awal (2026-10-16): kedua dokumen ini sempat disebut "independen" karena akar masalahnya memang beda, tapi itu keliru untuk SATU bagian spesifik. `cash-neutral-transaction-flag.md` merencanakan form Koreksi Saldo dapat field toggle baru — "Hitung sebagai transaksi kas di laporan?" — yang HANYA muncul untuk akun bertipe `cash` (lihat dokumen itu, bagian "Koreksi saldo — keputusan per tipe akun"). Nilai toggle itu disimpan ke kolom `is_cash_neutral` pada baris `transactions` yang dibuat `use-correct-account-balance.ts`.

Masalahnya: kolom `is_cash_neutral` BELUM ADA di skema — dia baru akan dibuat oleh migrasi yang direncanakan di `cash-neutral-transaction-flag.md` (langkah "Tulis migrasi SQLite"). Kalau pekerjaan di dokumen INI (balance-correction) dikerjakan lebih dulu dan mengimplementasikan toggle itu SEBELUM migrasi kolomnya ada, pilihan user ("ya"/"tidak") tidak akan punya tempat tersimpan — hilang begitu saja.

**Urutan kerja yang benar**: migrasi kolom `is_cash_neutral` (dari `cash-neutral-transaction-flag.md`) WAJIB selesai dulu sebelum bagian toggle "Hitung sebagai cashflow?" di form Koreksi Saldo bisa diimplementasikan secara nyata. Bagian LAIN dari dokumen ini (audit Dana Pihak Ketiga, desain solusi Utang/Piutang & Investasi untuk konsistensi data turunan) TETAP independen dan bisa dikerjakan kapan saja, tidak menunggu migrasi itu — dependency ini HANYA berlaku untuk pertanyaan "mau dicatat sebagai cashflow atau tidak" pada akun Kas.

### Akar masalah

[use-correct-account-balance.ts](../../../src/features/accounts/contents/detail/form/balance-correction/hooks/use-correct-account-balance.ts) generik total — menerima `accountId` apa pun, hitung selisih `targetBalance - currentBalance`, lalu insert SATU baris `income`/`expense` ke `transactions`. Tidak ada percabangan `account_type`, dan yang lebih penting: TIDAK PERNAH menyentuh tabel data turunan (`debts`, `investment_purchases`, `investment_sales`, `third_party_funds`) sama sekali.

Ini bukan bug kecil — `accounts.balance` ([use-accounts.ts:15-42](../../../src/hooks/resources/use-accounts.ts#L15-L42)) SELALU dihitung ulang dari agregasi `transactions` (initial_balance + income - expense - transfer), jadi Koreksi Saldo BERHASIL mengubah angka itu untuk akun tipe apa pun. Masalahnya baru muncul kalau akun itu juga punya data turunan lain yang TIDAK ikut disesuaikan.

### Kasus Utang/Piutang (sudah lama diketahui, didokumentasikan di `konsep-tipe-akun.md`)

`docs/concept/konsep-tipe-akun.md` baris 62-70 sudah menjelaskan: Koreksi Saldo pada akun bertipe Utang/Piutang mengubah saldo akunnya TANPA membuat atau menyesuaikan satu pun baris `debts` — saldo akun dan rincian "siapa berutang berapa" jadi tidak lagi saling menjelaskan, harus diperbaiki manual terpisah. Dokumen itu bahkan sudah memprediksi "berpotensi tipe lain nanti — misalnya Investasi dengan riwayat nilai beli/jual" sebagai catatan antisipatif, BELUM diverifikasi nyata saat itu.

### Kasus Investasi (dikonfirmasi nyata, 2026-10-16) — LEBIH RUMIT dari Utang/Piutang

[investment-holding-math.ts](../../../src/shared/investments/investment-holding-math.ts) menghitung dua angka kunci SAMA SEKALI TIDAK dari `accounts.balance`:

- `average_cost_per_unit` = `SUM(unit × price_per_unit) / SUM(unit)` dari `investment_purchases WHERE status='settled'`.
- `remaining_unit` = `SUM(unit, purchases settled) − SUM(unit, sales pending+settled)`.

Kedua angka ini dipakai di banyak tempat yang saling bergantung dan WAJIB konsisten satu sama lain (disebut eksplisit di README `apply-investment-transaction` sebagai "satu-satunya sumber rumus, supaya tidak pernah drift"): `apply-sell-investment-transaction.ts` (validasi oversell + snapshot `realized_pl`), `use-investment-holding-summary.ts` (tampilan form jual), `use-create-investment-sale.ts` (nominal leg transfer).

Kalau Koreksi Saldo dipakai di akun investasi:

- `accounts.balance` berubah sesuai koreksi (karena ini cuma agregasi `transactions`, akan selalu "berhasil" berubah).
- `average_cost_per_unit`/`remaining_unit` SAMA SEKALI TIDAK berubah (tabel sumbernya, `investment_purchases`/`investment_sales`, tidak pernah disentuh oleh Koreksi Saldo).
- Akibatnya: Unrealized P/L (yang bergantung pada `remaining_unit × harga_pasar − average_cost × remaining_unit`) jadi tidak merepresentasikan kenyataan, dan validasi oversell saat jual tetap memakai `remaining_unit` yang sudah basi.

### Kenapa Utang/Piutang TERNYATA tidak sesederhana dugaan awal

Koreksi dari diskusi 2026-10-16: kalimat awal dokumen ini ("satu angka `debts.amount`/`remaining` bisa disesuaikan langsung") keliru — itu cuma benar KALAU akun debt itu cuma punya SATU baris `debts` aktif. Pada kenyataannya satu akun `debt` (mis. "Utang Dagang") itu AKUN AGREGAT yang menampung BANYAK baris `debts` dari BANYAK kontak independen sekaligus — persis seperti akun kas menampung banyak transaksi, bedanya di sini tiap baris `debts` py identitas sendiri (kontak + nominal + status).

Akibatnya: Koreksi Saldo generik (satu field nominal, ditembak ke AKUN) tidak tahu APA-APA soal kontak mana yang nominalnya salah — kalau akun itu punya 5 kontak dengan utang aktif, sistem tidak bisa menebak otomatis kontak mana yang perlu disesuaikan supaya totalnya cocok ke saldo target. Jadi masalah strukturalnya SEBENARNYA mirip dengan Investasi (bukan lebih sederhana) — cuma beda bentuk ambiguitasnya: Investasi ambigu soal "unit atau harga yang salah", Utang/Piutang ambigu soal "kontak mana yang salah".

**Penting**: drift antara `accounts.balance` dan agregat `debts` BUKAN sesuatu yang terjadi acak/spontan — selama Koreksi Saldo generik TIDAK PERNAH dipakai di akun debt, kedua angka itu SELALU cocok (karena satu-satunya jalur yang mengubah `accounts.balance` untuk akun debt, `applyDebtTransaction`, SELALU menjaga `transactions` dan `debts`/`debt_payments` berubah bersamaan). Drift HANYA muncul sejak Koreksi Saldo generik dipakai di akun itu — persis sebesar nominal koreksi yang diinput, bukan besaran acak.

### Konsep jalur koreksi granular (diputuskan 2026-10-16)

Alih-alih "tolak total" vs "biarkan ambigu", solusinya: GANTI bentuk form Koreksi Saldo tergantung `account_type`, bukan satu form generik untuk semua tipe — sudah jadi arah desain yang disepakati untuk SEMUA tipe non-cash, bukan cuma debt (lihat juga poin Investasi di bawah, pola yang sama, input unit+harga alih-alih satu nominal).

Untuk akun bertipe `debt`, bentuknya:

1. User pilih SATU baris `debts` aktif dari daftar kontak/piutang-utang yang berjalan di akun itu — BUKAN langsung input saldo akun. Form menampilkan daftar debts aktif (kontak, nominal, remaining) persis seperti tampilan di halaman Utang Piutang.
2. User input nominal yang SEHARUSNYA untuk baris itu (bukan nominal akun).
3. Sistem hitung selisih = `nominal_seharusnya − debts.remaining saat ini`.
4. Buat SATU transaksi penutup `income`/`expense` pada `debt.account_id` sebesar selisih itu — pola sama persis `useWriteOffDebt()`, menjaga `accounts.balance` ikut berubah via jalur yang sudah ada (transaksi, bukan `UPDATE` langsung).
5. `debts.amount` (atau tambahan baris `debt_payments` penyesuaian) ikut disesuaikan supaya `remaining` benar-benar mencerminkan nominal baru — beda dari write-off yang SELALU membawa ke nol, di sini bisa ke angka berapa pun yang user maksud.
6. Transaksi penutup ini `is_cash_neutral = 1` (lihat `cash-neutral-transaction-flag.md`) — bukan kas riil.

Dengan user WAJIB memilih baris `debts` dulu, ambiguitas "baris mana yang disesuaikan" hilang — sistem selalu tahu persis target koreksinya, granular per kontak, bukan buta per akun.

### Validasi konsistensi pasca-koreksi (diputuskan 2026-10-16)

Dua mekanisme terpisah, beda tujuan — bukan saling menggantikan:

**1. Guard otomatis (dalam SATU mutation koreksi granular)** — setelah langkah 4-5 di "Konsep jalur koreksi granular" dijalankan, HITUNG ULANG dalam transaksi SQLite yang sama: `accounts.balance` (akun debt itu) vs `SUM(debts.remaining WHERE account_id = akun itu, status != 'written_off')` (atau rumus setara untuk investment/third_party nanti). Kalau TIDAK cocok, itu artinya logic koreksi granularnya SENDIRI yang salah (bug, bukan salah input user) — seluruh mutation (termasuk transaksi penutup yang baru di-insert) WAJIB di-ROLLBACK, tampilkan error ke user bahwa koreksi gagal karena ditemukan inkonsistensi internal. User tidak kehilangan apa pun (tidak ada yang tersimpan), tapi juga tidak bisa "memaksa" koreksi yang hasilnya sendiri tidak konsisten. Scope: cuma mengamankan jalur koreksi granular baru ini supaya tidak menambah drift baru karena bug implementasinya sendiri.

**2. Fitur "Cek Konsistensi" manual (read-only, terpisah dari mutation apa pun)** — dipicu user kapan saja (mis. tombol di halaman detail akun atau halaman Utang Piutang), menjalankan perbandingan yang sama (`accounts.balance` vs agregasi data turunan) untuk SEMUA akun non-cash, lalu tampilkan daftar akun yang drift beserta besaran selisihnya. TIDAK ada rollback (tidak ada mutation yang sedang berjalan) — ini laporan diagnostik murni. Berguna untuk mendeteksi drift yang SUDAH ADA dari sumber lain: sisa pemakaian Koreksi Saldo generik SEBELUM guard/jalur granular ini ada, bug lama, atau migrasi data yang tidak sempurna (persis kasus SPayLater yang memicu seluruh investigasi `cash-neutral-transaction-flag.md`). Sistem TIDAK mencoba memperbaiki otomatis — cuma melaporkan, karena sistem tidak tahu mana yang "benar" (saldo akun atau agregasi data turunan) tanpa konteks dari user.

Kebutuhan koreksi yang TIDAK cocok ke jalur granular ini (dan juga tidak cocok ke 3 jalur existing — edit transaksi, pelunasan, write-off) kemungkinan tidak akan pernah muncul dalam pemakaian normal, karena jalur granular ini pada dasarnya SUDAH mencakup semua kasus "nominal yang tercatat salah, perlu ditimpa ke angka yang benar" per kontak.

### Kenapa Investasi lebih rumit dari Utang/Piutang

Walau sama-sama butuh form khusus (bukan satu field nominal), Investasi tetap lebih rumit dari Utang/Piutang: TIDAK ADA satu angka tunggal yang bisa "ditambal" — average cost itu hasil PEMBAGIAN dari dua akumulasi independen (`SUM(unit × price)` dan `SUM(unit)`). Kalau user cuma mengoreksi NOMINAL saldo (seperti form sekarang), sistem tidak tahu: apakah penyesuaian ini karena jumlah UNIT yang salah (ada unit yang hilang/nambah tanpa tercatat), atau karena HARGA per unit yang salah (nilai pasar berubah tapi belum ter-update), atau kombinasi keduanya — ketiganya menghasilkan dampak berbeda ke `average_cost_per_unit` dan `remaining_unit`. Form Koreksi Saldo khusus investasi kemungkinan perlu input UNIT dan HARGA terpisah (bukan cuma satu nominal gabungan seperti Utang/Piutang di atas), supaya sistem tahu persis komponen mana yang dikoreksi — detail bentuk form ini belum didesain, baru arah konsepnya yang disepakati.

### Kasus Dana Pihak Ketiga — belum dianalisis

Tabel `third_party_funds` (lihat `account-type-third-party.md`) juga tabel data turunan independen dari `accounts.balance`, kemungkinan rentan masalah serupa — belum ditelusuri sama sekali, perlu audit sebelum fitur Koreksi Saldo dianggap aman dipakai di akun `third_party`.

### TEMUAN PENTING: worker/MCP SUDAH punya guard ini, desktop BELUM (2026-10-16)

Ditemukan saat membahas apakah topik ini juga perlu dibicarakan di sisi worker/MCP: worker (`apps/worker/src/modules/accounts/service.ts:232-262`, fungsi `correctAccountBalance`) SUDAH menolak Koreksi Saldo untuk akun bertipe `debt` MAUPUN `investment` — lihat `isAccountTypeRestrictedFromDirectTransaction` di [account-types.ts:39-46](../../../../worker/src/shared/account-types.ts#L39-L46), dengan komentar yang PERSIS mengantisipasi masalah yang baru kita bahas panjang lebar di dokumen ini ("manual langsung thd akun ini akan membuat `accounts.balance` tidak lagi mencerminkan riwayat pembelian/penjualan yang tersimpan"). Tool MCP `correct_account_balance` ([correct-account-balance.ts](../../../../mcp-server/src/lib/mcp-tools/accounts/correct-account-balance.ts)) memanggil endpoint worker ini, jadi otomatis ikut terlindungi.

Worker MENOLAK TOTAL (bukan jalur granular) — balas dengan pesan `"Saldo akun bertipe 'debt' tidak bisa dikoreksi langsung karena derived dari data piutang/utang -- gunakan transaksi transfer atau perbaiki transaksi akar penyebabnya."` Ini sejalan dengan opsi "tolak total" yang sempat dibahas di awal diskusi dokumen ini SEBELUM diputuskan ganti ke jalur granular — artinya worker punya solusi SEMENTARA yang lebih ketat (tolak total untuk `debt` DAN `investment`, tidak ada pengecualian), sedangkan desktop solusi akhirnya direncanakan lebih permisif (jalur granular, bukan tolak total).

**Implikasi**: urutan kerja JADI TERBALIK dari asumsi awal ("kerjakan desktop dulu, baru worker/MCP") — desktop JUSTRU yang paling tertinggal dan paling berisiko sekarang, karena [use-correct-account-balance.ts](../../../src/features/accounts/contents/detail/form/balance-correction/hooks/use-correct-account-balance.ts) di desktop BELUM punya guard apa pun, sementara worker sudah. Prioritas segera (independen dari jalur granular yang masih didesain): tambahkan guard TOLAK TOTAL yang setara di desktop (meniru `isAccountTypeRestrictedFromDirectTransaction`) SEBELUM jalur granular selesai didesain — supaya desktop minimal sejajar dengan proteksi yang worker sudah punya, bukan menunggu solusi akhir (jalur granular) baru terlindungi.

## Pekerjaan yang MASIH KOSONG

Urutan di bawah sudah memasukkan temuan "worker sudah punya guard, desktop belum" — butir 1 PALING URGENT, independen dari semua butir lain, kerjakan duluan. Butir 2-5 TIDAK bergantung pada `cash-neutral-transaction-flag.md`, bisa dikerjakan kapan saja setelah butir 1. Butir 7 (toggle akun Kas) BLOCKED BY migrasi kolom `is_cash_neutral` di dokumen itu — lihat "Hubungan dengan cash-neutral-transaction-flag.md" di atas.

1. **(PALING URGENT, kerjakan duluan)** Tambahkan guard TOLAK TOTAL di desktop untuk akun `debt`/`investment` pada [use-correct-account-balance.ts](../../../src/features/accounts/contents/detail/form/balance-correction/hooks/use-correct-account-balance.ts), meniru `isAccountTypeRestrictedFromDirectTransaction` di worker ([account-types.ts:39-46](../../../../worker/src/shared/account-types.ts#L39-L46)) — lihat "TEMUAN PENTING" di atas. Ini guard SEMENTARA, berlaku sampai jalur granular (butir 2-3) selesai, menutup celah yang sudah lama terbuka di desktop sementara worker sudah lebih dulu terlindungi.
2. Audit kasus Dana Pihak Ketiga — apakah `third_party_funds` punya masalah struktural yang sama, lalu desain jalur granularnya mengikuti pola yang sama (pilih baris data turunan dulu, baru input nominal seharusnya).
3. Implementasikan form Koreksi Saldo granular untuk akun `debt` sesuai "Konsep jalur koreksi granular" di atas — pilih baris `debts` dulu, bukan field saldo akun langsung. Setelah ini selesai, longgarkan guard tolak-total dari butir 1 KHUSUS untuk `debt` (ganti ke jalur granular, bukan ditolak lagi).
4. Desain detail bentuk form Koreksi Saldo granular untuk akun `investment` (field unit & harga terpisah, bukan satu nominal) — arah konsepnya sudah disepakati sama dengan debt, detail form-nya belum. Sama seperti butir 3, longgarkan guard tolak-total untuk `investment` setelah ini selesai.
5. Implementasikan guard otomatis (rollback on mismatch) di dalam mutation koreksi granular (`debt`, `investment`, dan `third_party` nanti) sesuai "Validasi konsistensi pasca-koreksi" poin 1 — bagian dari implementasi butir 3-4 di atas, bukan langkah terpisah setelahnya.
6. Implementasikan fitur "Cek Konsistensi" manual (read-only) sesuai "Validasi konsistensi pasca-koreksi" poin 2 — daftar akun non-cash yang `accounts.balance`-nya tidak cocok dengan agregasi data turunannya, berguna juga untuk deteksi drift lama (sebelum guard ini ada).
7. ~~Tambahkan field toggle "Hitung sebagai transaksi kas di laporan?" di form Koreksi Saldo, khusus akun bertipe `cash`~~ — SELESAI (2026-10-19), dikerjakan sekaligus saat menyelesaikan `cash-neutral-transaction-flag.md` langkah 5. Field `countAsCash` (schema.ts) + `FieldCountAsCash` (muncul HANYA utk `account_type==='cash'`) + `resolveIsCashNeutral()` di `use-correct-account-balance.ts` yg memaksa `true` tanpa tanya utk `debt`/`investment`. Diverifikasi lewat UI `tauri dev` nyata (2 transaksi koreksi dgn toggle beda, dicek ke copy DB dev — hasil sesuai). **PENTING**: ini HANYA menyelesaikan toggle cashflow-nya — guard tolak-total (butir 1) dan jalur granular (butir 2-6) di dokumen INI (konsistensi `accounts.balance` vs data turunan `debts`/`investment_purchases`) TETAP belum dikerjakan sama sekali, BEDA MASALAH dari toggle ini (lihat "Hubungan dengan cash-neutral-transaction-flag.md" di atas).
8. Verifikasi: uji Koreksi Saldo di tiap tipe akun (cash, debt, investment, third_party kalau relevan), pastikan tidak ada lagi kondisi "saldo akun berubah tapi data turunan tidak", dan toggle cashflow akun Kas tersimpan dengan benar.
9. Setelah desktop solid (jalur granular + guard + toggle Kas semua selesai), bawa solusi akhir yang sama ke worker/MCP — ganti guard tolak-total worker yang sekarang (sementara sudah benar, tapi lebih kaku dari jalur granular) dengan endpoint yang mendukung koreksi granular juga, supaya desktop dan worker/MCP akhirnya punya kapabilitas yang setara (bukan cuma worker yang "lebih aman tapi lebih terbatas").

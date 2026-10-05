# Redesain Halaman Laporan

## Status & TODO saat ini (ringkas)

Cashflow tab v1 SELESAI (query + UI + page.tsx dirapikan ke pola
`page-layout.md`) — lihat "Catatan implementasi Cashflow (2026-10-05)"
di bawah untuk detail. Per Tipe Akun & Tren Keuangan masih placeholder
"Segera hadir.", belum diimplementasikan — jadi task berikutnya.

**Cashflow:**
- [x] Tentukan layout dasar: period picker + grid 2 kolom + pie chart
  breakdown per grup akun + list persentase.
- [x] Transfer antar akun: exclude dari kas masuk/keluar.
- [x] Debt payment `non_cash`: otomatis ter-exclude, tidak perlu logic
  tambahan (lihat catatan implementasi di bawah).
- [x] Implementasi query breakdown kas keluar/masuk per `account_groups`.
- [x] Implementasi UI (component + page tab baru) — termasuk 3 card
  status (Pemasukan/Pengeluaran/Surplus-Defisit) di atas grid, dan
  list per kolom dibatasi tinggi + `ScrollArea` shadcn biar halaman
  tidak memanjang kalau grup akunnya banyak.
- [x] DIANGGAP SELESAI untuk v1 (2026-10-05) — tidak ada tambahan lain
  di bawah grid 2 kolom untuk sekarang, sesuai scope v1 yang sengaja
  dibatasi.
- [ ] Opening→closing balance rekonsiliasi — scope v1 ini BELUM
  termasuk (lihat "Cashflow — opsi konsep", poin 2), nanti dulu.

**Per Tipe Akun (pengganti "Per Akun"):**
- [x] Tentukan: tab "Per Akun" lama (horizontal bar chart semua akun,
  `AccountBalanceChart`) DIHAPUS TOTAL, diganti tab baru "Per Tipe
  Akun".
- [x] Tentukan layout: pie chart breakdown saldo per `account_type` di
  atas, summary card per tipe di bawahnya (bisa berubah setelah
  implementasi — lihat "Per Tipe Akun — layout final v1").
- [ ] Implementasi query breakdown saldo per `account_type`.
- [ ] Implementasi UI (component + page tab baru, hapus
  `AccountBalanceChart`/`use-account-balances.ts` lama kalau memang
  tidak dipakai di tempat lain).

**Ringkasan Bulanan & Per Kategori:**
- [x] Tentukan: KEDUANYA DIHAPUS, tidak dipindah/digabung ke mana pun
  secara eksplisit — dianggap sudah ter-cover oleh tab Cashflow (lihat
  "Kenapa Ringkasan Bulanan & Per Kategori dihapus" di bawah).
- [x] Hapus `MonthlySummaryChart`/`CategoryBreakdownChart` (komponen
  chart tab lama) beserta tab-nya di `reports/page.tsx`, dilakukan
  BARENGAN implementasi Cashflow. Catatan: `use-monthly-summary.ts`
  DIPERTAHANKAN (dipakai `dashboard/content/mini-trend-chart/`),
  `use-category-breakdown.ts` yang dihapus (tidak dipakai di luar
  komponen chart yang sudah dihapus) — lihat "Catatan implementasi
  Cashflow" di bawah.

**Tren Keuangan (tab baru):**
- [x] Tentukan konsep: snapshot kondisi keuangan di titik waktu
  tertentu, dirangkai jadi line chart dari waktu ke waktu — beda dari
  Cashflow (arus transaksi per periode) dan beda dari Per Tipe Akun
  (snapshot saat ini saja, bukan histori).
- [x] Tentukan filter: pilihan `account_type` (default `cash`, bisa
  pilih tipe lain/gabungan), granularitas titik data (default harian,
  bisa diganti mingguan/bulanan/tahunan), dan period picker (rentang
  tanggal yang ditampilkan).
- [x] Tentukan: filter panel dengan 3 filter level akun INDEPENDEN,
  bisa dikombinasikan sekaligus (AND) — tipe akun, grup akun
  (`account_groups`), dan akun individual. Semua opsional/bisa kosong;
  default tetap cuma `account_type = cash`. Lihat "Tren Keuangan —
  filter level akun" di bawah.
- [ ] Desain UI detail (chart tunggal line/area, ada perbandingan
  nilai awal-akhir periode atau tidak, dst).
- [ ] Desain query: hitung saldo akumulatif per titik waktu (mirip
  `use-account-balances.ts` tapi dgn cutoff tanggal berubah-ubah per
  titik, bukan cuma "saat ini") — lihat "Catatan performa" di bawah,
  berpotensi mahal kalau granularitas harian & rentang panjang.

**Hasil akhir halaman Laporan (setelah semua tahap ini):**
3 tab: **Cashflow**, **Per Tipe Akun**, dan **Tren Keuangan**. Tidak
ada lagi Ringkasan Bulanan/Per Kategori/Per Akun (lama).

**MCP tools pendamping:**
- [x] Tentukan: tiap laporan baru (Cashflow, Per Tipe Akun, Tren
  Keuangan) HARUS punya MCP tool read-only sendiri di
  `apps/mcp-server`, bukan cuma fitur UI desktop — supaya Claude lewat
  MCP juga bisa menjawab pertanyaan yang sama persis. Lihat "MCP
  tools — rencana" di bawah.
- [ ] Desain nama tool + input schema utk masing-masing (ikuti pola
  `get_expense_summary_by_category`/`get_account_balances` yang sudah
  ada).
- [ ] Implementasi fungsi agregasi di `lib/sync-snapshot.ts` (atau
  helper baru) — MCP tools baca dari snapshot worker/D1, BUKAN query
  SQLite lokal seperti desktop app, jadi logic agregasi perlu ditulis
  ULANG di sisi MCP (tidak bisa reuse query SQL dari
  `apps/desktop/src/features/reports/*`).
- [ ] Registrasi tool baru di `lib/mcp-tools/*/index.ts` sesuai domain.

## Latar belakang

Halaman Laporan (`apps/desktop/src/app/(app)/reports/page.tsx`) saat
ini punya 3 tab:

1. **Ringkasan Bulanan** — bar chart income vs expense per bulan
   (`use-monthly-summary.ts`), sebenarnya lebih mirip P&L sederhana
   daripada cashflow murni karena cuma hitung `type IN
   ('income','expense')`.
2. **Per Kategori** — donut chart breakdown income/expense per
   kategori (`use-category-breakdown.ts`), top 6 + "Lainnya". Filter
   `c.is_active = 1` — kategori yang sudah dinonaktifkan hilang dari
   chart walau transaksi historisnya tetap ada.
3. **Per Akun** — horizontal bar chart saldo akun saat ini
   (`use-account-balances.ts`), snapshot tanpa filter tanggal, tanpa
   tren waktu.

Tidak ada laporan cashflow (arus kas), laba/rugi formal, net worth
over time, atau export PDF/CSV di halaman ini saat ini.

Diputuskan untuk redesain UI/UX ketiganya (bukan cuma fix bug data),
dimulai dari tab Cashflow karena belum ada sama sekali secara konsep.

## Kenapa Ringkasan Bulanan & Per Kategori dihapus

Diputuskan 2026-10-05: tab **Ringkasan Bulanan** (income vs expense per
bulan) dan **Per Kategori** (breakdown income/expense per kategori
transaksi) DIHAPUS, bukan direvisi — dianggap sudah ter-cover oleh tab
Cashflow yang baru:

- Cashflow sudah tampilkan total pengeluaran & pemasukan per periode
  (menggantikan fungsi "Ringkasan Bulanan" sbg ringkasan income vs
  expense).
- Cashflow sudah tampilkan breakdown via pie chart + list persentase
  (menggantikan fungsi "Per Kategori" sbg breakdown visual), walau
  dimensinya beda (`account_groups`, bukan `categories` transaksi).

Lihat bagian "Status & TODO" di atas untuk daftar tab final halaman
Laporan setelah semua perubahan ini.

## Cashflow — opsi konsep

Laporan Cashflow beda fokus dari "Ringkasan Bulanan" yang sudah ada:
income/expense itu basis akrual sederhana, sedangkan cashflow harus
lihat SEMUA pergerakan kas riil, termasuk transfer dan pembayaran
utang/piutang yang bukan `income`/`expense`.

Komponen yang biasa ada di laporan cashflow, urut dari dasar ke
lanjutan:

1. **Kas masuk vs kas keluar (bukan income/expense)**
   - Kas masuk: income + pencairan piutang (debt payment diterima) +
     (opsional) transfer masuk antar akun.
   - Kas keluar: expense + pelunasan utang (debt payment dibayar) +
     (opsional) transfer keluar antar akun.
   - Transfer antar akun sendiri biasanya di-exclude kalau mau lihat
     cashflow "ke luar sistem" (uang cuma pindah kantong, bukan
     benar-benar masuk/keluar).

2. **Opening balance → closing balance (rekonsiliasi)**
   - Saldo awal periode + kas masuk − kas keluar = saldo akhir
     periode. Ini yang bikin laporan cashflow "nyambung", beda dari
     pie chart kategori yang berdiri sendiri.

3. **Breakdown per akun / kelompok akun**
   - Karena multi-akun (cash, bank, e-wallet, dst), cashflow idealnya
     dipecah per akun, bukan cuma agregat semua akun sekaligus.

4. **Klasifikasi operating/investing/financing (versi formal)**
   - *Operating*: income/expense harian.
   - *Investing*: beli/jual investasi, uang muka pembelian aset (lihat
     `account-type.md`, belum diimplementasikan).
   - *Financing*: utang baru ditarik / dilunasi.
   - Biasanya di-skip di app personal finance sederhana karena mayoritas
     transaksi personal itu "operating". Baru relevan kalau
     `account_type` investasi/utang sudah ada bedanya di skema.

5. **Tren arus kas bersih dari waktu ke waktu**
   - Line/area chart net cashflow per bulan — beda dari bar
     income-vs-expense yang sudah ada di tab Ringkasan Bulanan.

## Cashflow — layout final v1

Disepakati 2026-10-05 (berdasar referensi screenshot Money Manager tab
"Statistik"), scope SEDERHANA dulu — bukan poin 2/4 di atas:

- **Period picker** di bagian atas (mis. "< Okt 2026 >" + dropdown
  granularitas Bulanan/dst — ikut pola yang sudah ada di app kalau
  ada, bukan reinvent).
- **Grid 2 kolom** di bawah period picker:
  - Kiri: **Pengeluaran** — total nominal periode tsb di header kolom.
  - Kanan: **Pemasukan** — total nominal periode tsb di header kolom.
- Tiap kolom isinya:
  - Pie/donut chart breakdown **per `account_groups`** (grup akun:
    Aset Lancar, Bank, E-Wallet, Investasi, Utang — lihat
    `0005_account_groups.sql`), BUKAN per kategori transaksi seperti
    tab "Per Kategori" yang sudah ada.
  - List di bawah chart: nama grup + persentase + nominal, urut
    terbesar ke terkecil (pola sama seperti `CategoryBreakdownChart`
    yang sudah ada, tinggal ganti dimensi groupingnya).
- Cara hitung per kolom:
  - Pengeluaran per grup: SUM `transactions.amount` WHERE `type =
    'expense'`, di-join ke `accounts.group_id` lewat `account_id`.
  - Pemasukan per grup: SUM `transactions.amount` WHERE `type =
    'income'`, join sama lewat `account_id`.
  - Debt payment yang gerakin kas (`account_id` NOT NULL) ikut
    dihitung sesuai arahnya (bayar utang = keluar, terima piutang =
    masuk) — lihat "Catatan dari skema yang ada" di bawah.
- BELUM termasuk di v1: opening→closing balance (poin 2), klasifikasi
  operating/investing/financing (poin 4). Transfer antar akun: lihat
  "Pertanyaan terbuka" — masih perlu diputuskan include/exclude.

## Catatan implementasi Cashflow (2026-10-05)

- Transfer antar akun: diputuskan **exclude** — query Cashflow cuma
  filter `type IN ('income','expense')`, sesuai definisi cashflow
  standar ("uang cuma pindah kantong, bukan benar-benar masuk/keluar").
- Debt payment `non_cash` ternyata **otomatis ter-exclude TANPA perlu
  join `debts`/`debt_payments` sama sekali** — mode `non_cash` memang
  tidak pernah punya baris `transactions`, dan semua pergerakan kas
  riil (termasuk pokok utang/piutang & pelunasannya) SUDAH tercatat
  sebagai baris `transactions` biasa (lihat migrasi
  `0033_backfill_direct_debt_transactions.sql`, prinsip "saldo akun
  HANYA bisa berubah lewat transactions"). Jadi query Cashflow cukup
  query `transactions` → `accounts` → `account_groups`, tidak perlu
  tabel `debts`/`debt_payments` apapun.
- File: `features/reports/content/cashflow/use-cashflow-breakdown.ts`
  (query), `cashflow-column.tsx` (donut chart + list per kolom,
  reusable utk pengeluaran/pemasukan), `index.tsx` (section: card +
  `PeriodPicker` + grid 2 kolom, default period = bulan berjalan).
- `reports/page.tsx` dirapikan jadi orkestrator murni
  (`ReportsHeader` + `ReportsContent`) — sebelumnya melanggar
  `docs/rules/page-layout.md` (nulis `PageHeader`/`Tabs` langsung).
  Tab "Per Tipe Akun"/"Tren Keuangan" sementara placeholder "Segera
  hadir." di `ReportsContent`, pakai `BaseTabs`
  (`components/pattern/base-tabs.tsx`, pola config-array yang sudah
  dipakai di `features/retailku/summary/`) bukan `Tabs` mentah.
- Hook lama `use-monthly-summary.ts`/`use-account-balances.ts` TETAP
  dipertahankan (dipakai juga oleh `dashboard/` &
  `accounts/sections/balance-pie-chart/`) — yang dihapus cuma 3
  komponen chart tab lama (`MonthlySummaryChart`,
  `CategoryBreakdownChart`, `AccountBalanceChart`) dan
  `use-category-breakdown.ts` (tidak dipakai di tempat lain).
  `lib/query-dependencies.ts` diupdate: `categoryBreakdownQueryKey`
  dibuang, `cashflowBreakdownQueryKey` & `cashflowSummaryQueryKey`
  ditambahkan.
- `reports/page.tsx` pakai `<PageContainer maxWidth="6xl">` (bukan
  default `3xl`) — awalnya lupa di-set jadi halaman sempit terpusat,
  padahal halaman list/grid lain (Akun, Transaksi, Debts, dst) semua
  pakai `6xl`.
- Ditambah `CashflowSummaryCards` (`cashflow-summary-cards.tsx` +
  `use-cashflow-summary.ts`) — 3 card status (Pemasukan/Pengeluaran/
  Surplus-Defisit) full-width di atas grid 2 kolom, query terpisah
  dari breakdown per grup (cuma total, tanpa join `account_groups`).
- List persentase tiap `CashflowColumn` dibatasi tinggi (`h-64`) +
  dibungkus `ScrollArea` (shadcn) — supaya kalau grup akun banyak,
  scroll di dalam kolom, bukan memanjangkan seluruh halaman.
- Diputuskan (2026-10-05): TIDAK ada tambahan konten lain di bawah
  grid 2 kolom untuk v1 — summary card + breakdown dianggap cukup,
  opening→closing balance & operating/investing/financing tetap
  "nanti dulu" sesuai scope v1 di atas.

## Per Tipe Akun — layout final v1

Disepakati 2026-10-05. Motivasi: `account_type` sekarang cuma
`cash`/`debt` (lihat `0013_account_type.sql`), tapi `account-type.md`
berencana nambah `credit`/`investment`/`forex`/`advance` ke depan —
breakdown per tipe akan makin relevan begitu ragamnya nambah. Tab
"Per Akun" lama (`AccountBalanceChart`, horizontal bar chart semua
akun tanpa grouping) DIHAPUS TOTAL, digantikan tab baru ini.

- **Pie/donut chart** di atas — breakdown total saldo per
  `account_type` (mis. berapa total di `cash` vs berapa di `debt`,
  nanti nambah seiring tipe baru ditambahkan).
- **Summary card** di bawah chart — satu card per `account_type`,
  menampilkan total saldo tipe tsb. Bisa dapat tambahan/revisi setelah
  dilihat hasil implementasinya (belum final-final, lihat TODO).
- Belum diputuskan: apakah tab ini juga punya period picker (saldo itu
  snapshot "saat ini", beda sifat dari cashflow yang per-periode) —
  kemungkinan TIDAK perlu period picker karena ini snapshot, tapi
  belum dikonfirmasi eksplisit.
- Query dasarnya mirip `use-account-balances.ts` yang sudah ada (hitung
  saldo per akun dari `initial_balance` + agregat transaksi), tinggal
  di-GROUP BY `account_type` alih-alih tampil per akun individual.

## Tren Keuangan — layout final v1

Disepakati 2026-10-05. Beda sifat dari 2 tab lain: ini HISTORI (deret
titik waktu), bukan ringkasan satu periode (Cashflow) atau snapshot
tunggal saat ini (Per Tipe Akun).

- **Period picker** di bagian atas — rentang tanggal yang ditampilkan
  (mis. 1 bulan terakhir, 1 tahun terakhir, custom range).
- **Filter tipe akun** — select `account_type` yang diikutkan dalam
  perhitungan "kekayaan". Default: `cash` saja. User bisa ganti ke
  tipe lain atau kombinasi (mis. `cash` + `debt` buat versi net worth
  yg termasuk piutang/utang).
- **Filter granularitas** — titik data per hari/minggu/bulan/tahun.
  Default: harian.
- **Chart**: line/area chart, sumbu X = waktu (sesuai granularitas),
  sumbu Y = total saldo akun-akun yang difilter, dihitung di TIAP
  titik waktu (bukan cuma titik akhir).
- Cara hitung tiap titik: `initial_balance` akun-akun terfilter +
  akumulasi transaksi (`income`/`expense`/`transfer` sesuai arah akun)
  SAMPAI tanggal titik tsb — pada dasarnya query
  `use-account-balances.ts` yang sudah ada, diulang per titik waktu
  dengan cutoff tanggal berbeda-beda, bukan cuma "sampai sekarang".

## Tren Keuangan — filter level akun

Disepakati 2026-10-05, perluasan dari filter `account_type` di atas.
Filter panel dengan 3 filter level akun, SEMUA independen dan bisa
dipakai BERSAMAAN (AND), bukan mode saling eksklusif:

- **Tipe akun** (`account_type`) — default `cash`.
- **Grup akun** (`account_groups`) — mis. cuma "Bank".
- **Akun individual** — mis. cuma "Seabank".

Semua filter ini opsional (boleh kosong = tidak membatasi dimensi
itu). Query-nya tinggal tambah kondisi `WHERE` sesuai filter mana yang
diisi user — tidak perlu switch/mode terpisah. Contoh: tipe=`cash` DAN
grup=`Bank` DAN akun=kosong → tampilkan tren gabungan semua akun
bertipe cash YANG JUGA ada di grup Bank.

## Catatan performa — Tren Keuangan

Granularitas harian + rentang panjang (mis. 1 tahun = ~365 titik)
berpotensi mahal kalau query saldo-per-titik naif (re-scan semua
transaksi dari awal utk tiap titik = O(titik × transaksi)). Opsi
optimasi yang perlu dipertimbangkan saat implementasi (BUKAN keputusan
final, baru catatan):
- Hitung saldo kumulatif SEKALI terurut by date (running sum), bukan
  re-SUM per titik dari nol.
- Kalau granularitas bulanan/tahunan, titik data jauh lebih sedikit —
  cuma harian yang berisiko. Bisa pertimbangkan downsample otomatis
  kalau rentang panjang + granularitas harian dipilih bersamaan (mis.
  rentang > 90 hari otomatis sarankan ganti granularitas), TAPI ini
  masih ide, belum keputusan — user eksplisit minta harian jadi
  DEFAULT, jangan dihilangkan opsinya.

## MCP tools — rencana

Disepakati 2026-10-05: tiap tab laporan baru butuh MCP tool read-only
sendiri di `apps/mcp-server/src/lib/mcp-tools/`, mengikuti pola yang
sudah ada (`get_expense_summary_by_category`, `get_account_balances`
— baca `fetchFullSnapshot` dari worker, BUKAN query SQLite lokal
seperti di desktop app). Usulan awal, nama/schema final ditentukan
saat implementasi:

- **Cashflow** → `get_cashflow_breakdown` (folder `transactions/` atau
  `accounts/`, TBD). Input: `from`/`to` (tanggal), opsional filter
  `account_group_id`. Output: breakdown pengeluaran & pemasukan per
  `account_groups` untuk periode tsb — cermin dari layout UI di
  "Cashflow — layout final v1".
- **Per Tipe Akun** → `get_balances_by_account_type` (folder
  `accounts/`). Input: tidak ada (snapshot saat ini) kecuali nanti
  diputuskan perlu period picker (lihat "Pertanyaan terbuka"). Output:
  total saldo per `account_type`.
- **Tren Keuangan** → `get_balance_trend` (folder `accounts/`). Input:
  `from`/`to`, `granularity` (`day`/`week`/`month`/`year`, default
  `day`), opsional `account_type`/`account_group_id`/`account_id`
  (cermin filter panel di "Tren Keuangan — filter level akun"). Output:
  deret titik waktu + saldo kumulatif per titik.

**Update 2026-10-05, dicek langsung kodenya**
(`apps/mcp-server/src/lib/mcp-tools/accounts/get-account-balances.ts`):
`get_account_balances` yang SUDAH ADA mengembalikan array per akun yang
SUDAH menyertakan `accountType` dan `groupName` tiap baris (lihat
`computeAccountBalance`/`listAliveAccounts` di `lib/sync-snapshot.ts`).
Artinya breakdown "Per Tipe Akun" (total saldo per `account_type`)
bisa dihitung Claude cukup dari agregasi output tool ini — **TIDAK
perlu tool/field baru di MCP** untuk kebutuhan ini. `get_balances_by_account_type`
di atas kemungkinan JADI TIDAK PERLU dibuat — dicoret dari rencana
kecuali nanti ternyata agregasi manual oleh model kurang akurat/mahal
utk dataset besar.

## Catatan dari skema yang ada

- `transactions.type` cuma `income | expense | transfer`. Tabel
  `debts`/`debt_payments` terpisah, dan ada mode pencatatan utang:
  - mode `direct` — tanpa transaksi kas sama sekali (`account_id`
    NULL di `debts`).
  - mode `non_cash` — pelunasan TANPA pergerakan kas (barter,
    pemutihan, offset), `transaction_id` NULL di `debt_payments`.
  - Lihat `debts-sync-and-non-transfer-debts.md` dan
    `debt-receivable-tracking.md` (done) untuk detail mode-mode ini.
- Laporan cashflow HARUS exclude debt payment mode `non_cash` (tidak
  gerakin kas) dan HARUS include debt payment yang benar-benar
  terjadi lewat `account_id` (gerakin kas), supaya rekonsiliasi
  opening→closing balance di poin 2 akurat.
- `account_type` saat ini cuma `'cash'`/`'debt'` (migrasi
  `0013_account_type.sql`) — klasifikasi investing di poin 4 baru bisa
  diimplementasikan penuh setelah `account-type.md` (varian
  `investment`) selesai. Untuk versi awal, klasifikasi
  operating/investing/financing bisa di-skip atau disederhanakan.

## Pertanyaan terbuka

- Cashflow: sesederhana poin 1-3, atau sekalian poin 4
  (operating/investing/financing)?
- ~~Transfer antar akun: include atau exclude dari kas masuk/keluar?~~
  SUDAH DIPUTUSKAN 2026-10-05: exclude. Lihat checklist Cashflow di atas.
- Per Tipe Akun: perlu period picker atau murni snapshot saat ini?
- Tren Keuangan: perlu downsample otomatis saat rentang panjang +
  granularitas harian dipilih bersamaan, atau biarkan apa adanya
  (mengandalkan optimasi query running-sum saja)?
- Urutan tab final di halaman Laporan: Cashflow, Per Tipe Akun, Tren
  Keuangan — urutan ini belum dikonfirmasi eksplisit, masih asumsi
  urutan pembahasan.
- MCP: `get_balances_by_account_type` SEMENTARA dicoret (lihat update
  2026-10-05 di "MCP tools — rencana") — `get_account_balances` yang
  ada sudah cukup. Konfirmasi ulang saat implementasi Tren Keuangan
  apakah agregasi per tipe/grup akun oleh model cukup, atau tetap
  butuh tool khusus utk dataset besar.

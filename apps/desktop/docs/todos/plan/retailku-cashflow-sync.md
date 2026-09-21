# Sync Cashflow Harian dari Retailku

> Lanjutan dari `retailku-account-mapping.md` (status: SELESAI —
> mapping akun Retailku ↔ akun lokal sudah bisa disimpan). Dokumen ini
> fokus pada satu fitur: setiap hari, `financial-app` otomatis mencatat
> SATU transaksi ringkasan dari arus kas bisnis Retailku, supaya tidak
> perlu input manual dobel seperti histori Money Manager selama ini
> (lihat "Bentuk konkret yang diinginkan" di `retailku-integration.md`
> — sudah dipindah ke `docs/todos/done/`).

## Keputusan yang SUDAH diambil

**1. Sumber data: `get_cashflow_summary`, BUKAN `get_cashflow_allocation`.**

Dicek langsung lewat panggilan nyata ke MCP "Warung Aqil"
(`dateFrom=2026-09-19, dateTo=2026-09-20`):

- `get_cashflow_allocation` mengembalikan breakdown per `sourceType` →
  `accountName`, TAPI levelnya akun COA PENUH — termasuk akun non-kas
  (HPP, Persediaan) yang saling meng-offset dalam satu `sourceType`.
  Rencana awal di `retailku-integration.md` ("1 baris ringkasan per
  `sourceType`, `amount` = net dari alokasi itu") TIDAK bisa langsung
  dipakai — perlu filter breakdown ke akun kas saja, tapi breakdown
  tidak punya `accountId`/`isPaymentMethod`, cuma `accountName` (string)
  — pencocokan by nama berisiko rapuh (rename akun, nama mirip, dst).
- `get_cashflow_summary` mengembalikan `{date, inflow, outflow, net}`
  per hari — **angka kas MURNI**, deskripsinya eksplisit "bersumber
  dari jurnal akun kas/bank yang terposting". Tidak ada breakdown
  `sourceType`, tapi dijamin akurat karena langsung dari jurnal kas,
  bukan hasil filter manual di sisi `financial-app`.

**Diputuskan: pakai `get_cashflow_summary`, satu transaksi ringkasan
per hari** (bukan per `sourceType`) — `type` income kalau `net` positif
/ expense kalau negatif, `amount` = `net` (atau catat `inflow` dan
`outflow` sebagai dua transaksi terpisah kalau mau kelihatan kotor,
lihat "Pertanyaan terbuka" di bawah), `note` generik (mis. "Ringkasan
Kas Harian Retailku"). Ini mengorbankan detail granular per sourceType
(seperti histori manual Money Manager "Omzet Dagang"/"Pembelian
Stok"/dst) demi akurasi dan kesederhanaan — trade-off yang dipilih
sadar, bukan default sisa waktu.

**Bukti tambahan dari `get_journal_list`/`get_journal_detail`** (dicek
satu entri nyata, jurnal `JNL-260921-06` sumber `SALE`): satu transaksi
penjualan menghasilkan 4 baris jurnal — debit "Kas Tunai" (akun kas,
Rp2.000), debit "HPP" (Rp486.08), kredit "Persediaan Barang"
(Rp486.08), kredit "Penjualan Retail" (Rp2.000). Ini mengonfirmasi
persis kekhawatiran soal `get_cashflow_allocation`: hanya baris
"Kas Tunai" yang relevan untuk sync kas, dan itu cuma bisa dipastikan
lewat `accountId` di level item jurnal (`get_journal_detail`/
`get_journal_list`), BUKAN dari `accountName` string yang dikembalikan
`get_cashflow_allocation`.

**Dicek langsung ke source `retail-multitenant`
(`get-cfr-allocation.helper.ts`/`get-cfr-summary.helper.ts`)** untuk
memahami mekanisme sebenarnya, bukan cuma dari bentuk output:

- Filter akun kas di Retailku BUKAN `isPaymentMethod`, tapi
  **`isTrackedAsset`** (istilah UI-nya "Ringkasan Kas" —
  `create-finance-accounts.ts`). Untuk Warung Aqil kedua flag itu
  kebetulan SELALU sama-sama `true`/`false` di akun yang sama, TAPI
  keduanya field terpisah secara skema — cuma divalidasi TIDAK BOLEH
  bersamaan dengan `isInvestmentAccount`, tidak ada aturan yang
  memaksanya identik dengan `isPaymentMethod`. Jangan asumsikan
  keduanya selalu sama di toko lain/di masa depan.
- **Temuan besar**: `get_cashflow_allocation` (`get-cfr-allocation.helper.ts`)
  MEMANG memfilter jurnal yang menyentuh akun `isTrackedAsset` (baris kas
  ADA di jurnal itu), TAPI breakdown yang dikembalikan justru
  **MENGECUALIKAN** akun `isTrackedAsset` itu sendiri
  (`if (!item.account.isTrackedAsset)`) — breakdown-nya adalah AKUN
  LAWAN non-kas, bukan angka kasnya. Jadi `"Penjualan Retail": -130000`
  di breakdown SALE itu sisi kredit akun revenue, BUKAN representasi
  uang keluar — nilai kas yang sebenarnya (`+130000` di akun kas)
  SENGAJA tidak pernah muncul di tool ini. Filter "cocokkan breakdown ke
  akun kas by nama" yang sempat disebut sebagai opsi cadangan
  SEBELUMNYA **TIDAK MUNGKIN dilakukan** dari `get_cashflow_allocation`
  — baris kasnya memang tidak pernah ada di situ.
- **Daftar `sourceType` yang benar-benar menggerakkan kas** (dicek dari
  panggilan nyata rentang 2026-08-01 s/d 2026-09-21): `SALE` (penjualan
  TUNAI saja, bagian piutang tidak menggerakkan kas), `SALE_PAYMENT`
  (pelunasan piutang), `DIRECT_PURCHASE` (pembelian tunai),
  `PURCHASE_ORDER` (uang muka), `PURCHASE_PAYMENT` (pelunasan utang
  dagang), `OPERATIONAL_EXPENSE`, `OTHER_INCOME`, `LEDGER_ENTRY` /
  `LEDGER_ENTRY_PAYMENT` (utang-piutang non-dagang manual),
  `CASH_OPNAME` / `BALANCE_ADJUSTMENT`, `INVESTMENT_TRANSACTION`,
  `EQUITY_TRANSACTION`, `FUND_TRANSFER`, `CONSIGNMENT_SETTLEMENT`.
  Intinya BUKAN "sourceType dagang tertentu" yang menggerakkan kas,
  tapi APAPUN sourceType-nya SELAMA pembayarannya benar-benar terjadi
  saat itu (tunai) — piutang/utang yang belum dilunasi TIDAK
  menggerakkan kas sampai ada `_PAYMENT`-nya. Mencoba mereplikasi logic
  "sourceType mana yang cash mana yang bukan" sendiri di
  `financial-app` sudah terbukti rumit dan gampang salah — `get_cashflow_summary`
  sudah menghitungnya dengan benar di sisi Retailku, memperkuat lagi
  kenapa itu sumber yang tepat.

**Dicek juga apakah tab "Pergerakan" di halaman Cashflow Retailku**
(screenshot user: tabel detail transaksi harian — tanggal, akun kas,
sumber, masuk, keluar, mis. "1101 - Kas Tunai, SL-260921-01, Masuk
Rp3.000") diekspos lewat MCP — AWALNYA TIDAK. Di source
`retail-multitenant`, tab itu di-power oleh `getCfrDetailHelper`
(`get-cfr-detail.helper.ts`) — beda dari `getCfrAllocationHelper`,
helper ini JUSTRU mengembalikan item akun `isTrackedAsset: true` itu
sendiri (bukan mengecualikannya), lengkap dengan `accountId`,
`accountCode`, `accountName`, `debit`/`credit`, `sourceType`,
`sourceNumber` per baris — ini persis bentuk data paling ideal untuk
sync granular per transaksi. Awalnya folder
`helpers/mcp/finance/cashflow/` cuma berisi `get-cashflow-allocation.ts`
dan `get-cashflow-summary.ts`, `getCfrDetailHelper` belum diekspos
sebagai MCP tool.

**SUDAH DIBANGUN & DIDEPLOY — `get_cashflow_detail`.** Karena
`getCfrDetailHelper` sudah ada dan teruji (dipakai production oleh web
app Retailku), risikonya rendah untuk sekadar dibungkus jadi tool MCP
baru (bukan menulis logic baru dari nol). File baru:
`apps/api/src/helpers/mcp/finance/cashflow/get-cashflow-detail.ts` (di
repo `retail-multitenant`), didaftarkan di `index.ts` folder yang
sama — commit `9ea9410b "Update MCP"`. Tool `get_cashflow_detail`
menerima `dateFrom`/`dateTo`/`timezone`/`page`/`limit`, mengembalikan
array `{date, description, sourceType, sourceNumber, accountId,
accountCode, accountName, debit, credit}` per baris kas (dengan
pagination karena bisa banyak baris).

**Dikonfirmasi LIVE via "Tes Koneksi" di halaman Settings
`financial-app`**: jumlah tools naik dari 101 → **102** (persis +1),
mengonfirmasi server MCP Retailku sudah ter-restart dan tool baru ini
aktif. (Catatan: tool ini sempat tidak terlihat dari sesi Claude yang
mengerjakan dokumen ini di beberapa percobaan awal — kemungkinan daftar
tool untuk integrasi Claude di-cache terpisah dari koneksi
`financial-app` sendiri, butuh reconnect di sisi claude.ai untuk
ter-refresh — tapi ini di luar kendali langsung dari sesi manapun, dan
bukti dari `financial-app` sendiri sudah cukup meyakinkan bahwa tool-nya
aktif di server.)

**Diverifikasi lebih lanjut — UI tab Ringkasan/Alokasi/Pergerakan sudah
dibangun DAN dicek visual cocok dengan Retailku:**
- Halaman `/retailku/cashflow` (`features/retailku/cashflow-sync-panel.tsx`)
  sekarang punya tab utama "Ringkasan"/"Konfigurasi", dan di dalam
  "Ringkasan" ada input rentang tanggal + 3 sub-tab meniru struktur
  Retailku: `cashflow-summary-tab.tsx` (`get_cashflow_summary`),
  `cashflow-allocation-tab.tsx` (`get_cashflow_allocation`),
  `cashflow-detail-tab.tsx` (`get_cashflow_detail`, dengan pagination).
- **Sub-tab Ringkasan**: dibandingkan screenshot langsung dengan
  halaman Cashflow Retailku (periode sama) — Total Pemasukan
  Rp2.424.914, Total Pengeluaran Rp1.993.115, Net Periode Rp431.799,
  dan rincian per hari (21/20/19 Sept) SEMUA COCOK PERSIS.
- **Sub-tab Pergerakan**: dibandingkan juga — baris transaksi (mis.
  "Penjualan SL-260901-01" Rp5.000, "Tukerin Teh Rio" Rp4.000 tanpa
  `sourceNumber`) cocok dengan tab "Pergerakan" Retailku. Ditemukan &
  DIPERBAIKI bug tampilan: kolom Tanggal awalnya menampilkan timestamp
  ISO penuh (`2026-09-01T00:40:33.721Z`, beda dari `get_cashflow_summary`
  yang cuma `YYYY-MM-DD`) — ditambahkan style `date-only` baru di
  `lib/format-date.ts` untuk memotong ke tanggal saja.
- Diverifikasi `tsc --noEmit`/`npm test` (94/94)/`npm run build` (16
  route, termasuk `/retailku/cashflow`) — semua bersih.

**Pola yang mulai terlihat dari data `get_cashflow_detail` (baris
per-transaksi)**: ada DUA kategori baris berbeda —
1. Baris dengan `sourceType`/`sourceNumber` terisi (mis. "Penjualan
   SL-260901-01", `sourceNumber: "SL-260901-01"`) — transaksi
   terstruktur dari modul Retailku (Penjualan, Pembelian, dll),
   `sourceType`-nya jelas dan BISA diagregasi per kategori — ini
   persis kebutuhan "mode detail" yang sudah didesain di #6.
2. Baris TANPA `sourceType`/`sourceNumber` (mis. "Tukerin Teh Rio",
   `description` custom tapi sumbernya kosong) — kemungkinan entri
   manual/`LEDGER_ENTRY` atau jenis transaksi lain yang tidak
   terstruktur formal. Baris tipe ini PERLU keputusan terpisah saat
   agregasi mode detail nanti — masuk kategori "Lainnya"? diabaikan?
   Belum diputuskan, dicatat sebagai pertanyaan lanjutan untuk
   implementasi mode detail.

Ini MENGUBAH kalkulus keputusan #1 di atas — breakdown granular per
`sourceType`/per transaksi kini SECARA TEKNIS memungkinkan tanpa harus
lewat `get_journal_list`/`get_journal_detail` yang berat. TETAP PERLU
DIPUTUSKAN apakah desain sync yang sudah ada (1 transaksi ringkasan per
hari dari `get_cashflow_summary`) diganti/dilengkapi pakai
`get_cashflow_detail` — lihat "Pertanyaan terbuka #6" di bawah.

`get_journal_list`/`get_journal_detail` SEBENARNYA sumber paling akurat
(filter `accountId` pasti benar, bukan cocokkan nama), TAPI levelnya
per-transaksi individual — perlu `get_journal_list` dulu untuk semua ID
di suatu hari, lalu `get_journal_detail` satu-satu. Untuk toko ramai ini
bisa puluhan/ratusan panggilan per hari sync, jauh lebih berat
dibanding satu panggilan `get_cashflow_summary` yang sudah teragregasi
dan dijamin akurat. Dicatat di sini sebagai OPSI CADANGAN kalau nanti
breakdown per-`sourceType` benar-benar dibutuhkan (lihat "Di luar
cakupan dokumen ini") — bukan pendekatan yang dipilih sekarang.

**Dicek juga `get_profit_loss` untuk periode yang sama (19-20 Sept)**
untuk memastikan laba rugi TIDAK bisa dipakai sebagai proxy cashflow:
`netIncome` = Rp80.658,64, sedangkan `net` dari `get_cashflow_summary`
periode sama = Rp121.000 — SELISIH BESAR, dan ini benar secara
akuntansi (bukan bug/inkonsistensi data). P&L pakai akrual (HPP diakui
saat barang TERJUAL, bukan saat kas keluar buat beli stoknya; kas
pembelian stok sudah keluar duluan saat `DIRECT_PURCHASE`/
`PURCHASE_ORDER`), cashflow pakai kas fisik. Akun P&L seperti HPP/Beban
Depresiasi TIDAK PERNAH menggerakkan kas langsung; Revenue cuma
menggerakkan kas kalau penjualannya tunai (bukan piutang). Ini
mengonfirmasi ULANG bahwa `get_cashflow_summary` (bukan
`get_profit_loss` ataupun `get_cashflow_allocation`) satu-satunya
sumber yang tepat untuk "uang yang benar-benar berpindah" — dua laporan
lain sama-sama mengukur hal lain (akrual/breakdown akun COA), bukan
pergerakan kas murni.

**2. Akun tujuan — REVISI TOTAL: per akun kas Retailku sendiri-sendiri, BUKAN konvergen ke satu akun lokal.**

Keputusan lama (di bawah, dicoret) DIBATALKAN setelah ditemukan masalah
nyata saat live testing: memaksa "Kas Tunai" + "Seabank" konvergen ke
SATU akun lokal (mis. "Dompet Bisnis") membuat AUDIT PER AKUN FISIK
JADI TIDAK MUNGKIN — saldo "Dompet Bisnis" di `financial-app` jadi
campuran laci kasir + rekening bank, tidak bisa dicocokkan ke saldo
fisik akun manapun. Ini konsekuensi serius yang sebelumnya tidak
disadari saat keputusan lama diambil.

**Solusi: sumber data cashflow DIGANTI SELURUHNYA ke `get_cashflow_detail`
(punya `accountId` per baris), TIDAK LAGI memakai `get_cashflow_summary`
sama sekali** — termasuk untuk apa yang sebelumnya disebut "mode
ringkas". Kedua mode (lihat keputusan #6) sekarang SAMA-SAMA bersumber
dari `get_cashflow_detail`, bedanya cuma level agregasi:
- **Mode ringkas**: agregasi per `(tanggal, accountId Retailku)` — 1
  transaksi per akun kas Retailku per hari, TAPI di-insert ke akun
  LOKAL masing-masing sesuai `retailku_account_mapping`-nya sendiri
  (bukan satu akun gabungan lagi).
- **Mode detail**: agregasi per `(tanggal, accountId Retailku,
  sourceType)` — ditambah dimensi akun dibanding desain lama yang cuma
  per `(tanggal, sourceType)`, supaya konsisten (kalau tidak, mode
  detail masih akan menggabungkan lintas akun kas Retailku juga).

**Konsekuensi: validasi prasyarat "semua mapping harus ke akun lokal
yang SAMA" DIHAPUS SEPENUHNYA** — tidak relevan lagi karena setiap akun
Retailku sekarang sync ke akun lokalnya SENDIRI-SENDIRI sesuai baris
mapping masing-masing, tidak ada lagi "satu akun tujuan gabungan".
Prasyarat yang TETAP ada: setiap akun kas Retailku yang muncul di
`get_cashflow_detail` HARUS punya baris mapping (kalau ada `accountId`
yang belum dipetakan ke akun lokal manapun, baris itu di-skip dengan
peringatan, bukan gagal total — lihat TODO).

~~`get_cashflow_summary` mengembalikan angka GABUNGAN semua akun kas
Retailku (tidak per-akun) — konsekuensinya, transaksi ringkasan harian
ini cuma bisa dicatat ke SATU `account_id` lokal. Diputuskan: skema
mapping (`retailku_account_mapping`, sudah ada) MEMANG mendukung
banyak akun Retailku → 1 akun lokal (pola "Kas Tunai" + "Seabank" → 1
akun "Dompet Bisnis"), dan itu jadi PRASYARAT sync ini — semua baris
mapping WAJIB mengarah ke akun lokal yang SAMA sebelum sync bisa
jalan. Kalau user memetakan ke akun lokal yang berbeda-beda, sync
ditolak dengan pesan jelas (bukan dipaksa/diam-diam pilih salah satu).~~

## Keterkaitan dengan sync utang-piutang (AR/AP) — dibahas di sesi terpisah

Muncul dari pertanyaan: kalau `net` cashflow dicatat apa adanya (keputusan
#1 di atas), apakah itu "bersih" secara laporan keuangan pribadi? Jawaban
singkat: TIDAK sepenuhnya — sebagian `net` bisa jadi titipan (mis.
penjualan produk konsinyasi, uangnya masuk kas penuh tapi sebagian WAJIB
disetor ke penitip lewat `CONSIGNMENT_SETTLEMENT`, lihat `get_ar_ap`
type=SUPPLIER). TAPI ini bukan alasan untuk memotong `net` — mencoba
menghitung "porsi konsinyasi dari net hari ini" akan mengulang masalah
yang sudah terbukti rapuh di keputusan #1 (`get_cashflow_allocation`).
Cara yang benar: cashflow sync (dokumen ini) TETAP apa adanya, DAN
disandingkan dengan sync utang-piutang terpisah (dokumen baru, belum
ditulis, menyusul pola `retailku-account-mapping.md` bagian "Catatan
eksplorasi: kaitan dengan utang-piutang") yang mengambil `get_ar_ap` →
mencatat kewajiban/piutang gabungan sebagai `debts` lokal.

**Bentuk keterhubungannya — dikonfirmasi dari skema & data nyata
(`finance.dev.db`, tabel `debts`/`debt_payments`, lihat kolom
`transaction_id` NOT NULL secara desain meski nullable di skema)**:
setiap baris `debts`/`debt_payments` SELALU lahir sebagai efek samping
dari satu `transactions` nyata lewat `applyDebtTransaction()`
(`shared/debts/apply-debt-transaction.ts`) — TIDAK PERNAH `INSERT
INTO debts` langsung. Konsekuensinya untuk sync:

- **Sync AR/AP HARUS lewat jalur yang SAMA PERSIS dengan input manual**
  — panggil `applyDebtTransaction()` yang sama yang dipanggil
  `use-create-transaction.ts` sekarang, bukan menulis logic insert baru.
  Alurnya: (1) ambil data mentah dari MCP Retailku (`get_cashflow_summary`
  DAN `get_ar_ap`, dipanggil dulu, sebelum insert apa pun dimulai), (2)
  hitung/susun transaksi apa saja yang perlu dibuat di sisi
  `financial-app`, (3) panggil fungsi create-transaction yang sama
  seperti form manual (cuma `source='retailku_sync'` alih-alih
  `'manual'`) — sync App ini pada dasarnya "mengisi form yang sama
  secara otomatis", bukan jalur data terpisah.
- **Cashflow sync dan AR/AP sync tetap MENGHASILKAN BARIS TRANSAKSI
  BERBEDA** — cashflow insert `transactions` tipe income/expense biasa
  (akun kas lokal), AR/AP insert `transactions` tipe transfer (cash↔akun
  `debt`) yang memicu `debts` sebagai efek samping. Bukan satu transaksi
  gabungan — skema `transactions` tidak punya mekanisme "transaksi ini
  terkait transaksi lain" selain `debts.transaction_id` yang satu arah.
  Piutang gabungan dan utang gabungan dari Retailku memakai DUA kontak
  lokal terpisah (sudah diputuskan di `retailku-account-mapping.md`).

**DIPUTUSKAN: satu tombol "Sync Sekarang" menjalankan KEDUANYA (cashflow
+ AR/AP) sekaligus, bukan dua trigger terpisah** — supaya kas dan
kewajiban selalu update bersamaan, tidak ada jeda "kas sudah naik tapi
utang belum tercatat".

**DIPUTUSKAN: tampilan read-only data AR/AP saat ini jadi SUB-TAB BARU
di `/retailku/cashflow`** (`CashflowSyncPanel`), BUKAN halaman terpisah.
Tujuannya murni melihat posisi utang-piutang Retailku SEKARANG (panggil
`get_ar_ap`, tabel pihak/tipe CUSTOMER-SUPPLIER/outstanding
receivable-payable) — sama seperti 3 sub-tab Ringkasan/Alokasi/Pergerakan
yang sudah ada, BUKAN bagian dari kontrol sync (tombol/status/trigger,
itu tetap di halaman `/retailku/sync` terpisah, lihat #3). `get_ar_ap`
tidak punya filter tanggal (snapshot saat ini, bukan rentang), jadi tab
ini TIDAK perlu ikut input rentang tanggal yang dipakai 3 tab lain.

**DIPUTUSKAN: mode kegagalan ALL-OR-NOTHING** — kalau salah satu (cashflow
ATAU AR/AP) gagal, SEMUANYA di-rollback, tidak ada yang tersimpan
sebagian. Konsekuensi teknis:
- SEMUA data dari MCP (cashflow + AR/AP) diambil dulu SEBELUM insert apa
  pun ke SQLite dimulai — bukan insert-sambil-jalan lalu rollback manual
  kalau gagal di tengah (rawan crash mid-way meninggalkan data setengah).
- Insert ke SQLite dibungkus SATU database transaction
  (`BEGIN`...`COMMIT`/`ROLLBACK`) yang mencakup baris cashflow DAN baris
  AR/AP sekaligus — atomicity dijamin di level database, bukan di level
  aplikasi.
- Implikasi ke idempotency (`source_ref`, lihat "Pertanyaan terbuka #1"):
  sync yang gagal TIDAK meninggalkan `source_ref` baru sama sekali —
  sync berikutnya akan mencoba ulang rentang tanggal yang sama dari nol,
  bukan menganggapnya "sudah dicoba, sudah gagal".
- **Trade-off yang disadari dan diterima**: kalau cashflow untuk N hari
  berhasil dihitung tapi AR/AP gagal di satu titik, N hari cashflow yang
  valid itu IKUT batal (tidak tersimpan) sampai sync berikutnya berhasil
  penuh. Dipilih sengaja demi konsistensi ("kas dan utang-piutang tidak
  pernah boleh tidak sinkron") di atas "progres sebagian tetap
  tersimpan".

## Kasus PPOB — dicek dari data nyata, BUKAN 2 baris "HPP vs Margin"

Koreksi asumsi lama di `retailku-account-mapping.md` ("PPOB → satu
transaksi asal → dua baris berbeda, HPP Harian Digital dan Margin
Harian Digital") — dicek langsung lewat `get_sale_detail`/
`get_journal_detail` untuk satu transaksi PPOB nyata (`SL-260914-19`,
"Pulsa Listrik", Rp23.000, `product.type: "PPOB"`). Jurnalnya SEBENARNYA
4 baris: debit Piutang Dagang Rp23.000, debit HPP PPOB Rp21.375, kredit
Pendapatan PPOB Rp23.000, kredit **Seabank** (akun kas `isTrackedAsset`)
Rp21.375 — bayar ke provider PPOB terjadi SAAT itu juga, TAPI pelunasan
dari customer (Kas Tunai masuk Rp23.000) baru terjadi keesokan harinya
lewat `SALE_PAYMENT` terpisah (`SP-260914-01`).

**Konsekuensi yang disadari dan DITERIMA (trade-off, bukan bug)**: kalau
cashflow sync (mode ringkas maupun detail) memproses ini apa adanya,
hasilnya adalah DUA baris kas yang terlihat tidak berhubungan — outflow
Rp21.375 di tanggal transaksi (akun Seabank, sourceType `SALE`) dan
inflow Rp23.000 di tanggal lain (akun Kas Tunai, sourceType
`SALE_PAYMENT`) — bukan "untung Rp1.625 dari jualan pulsa" yang
tergabung jadi satu cerita. Ini BUKAN kasus khusus PPOB semata, tapi
pola umum SETIAP penjualan yang awalnya piutang (lihat daftar sourceType
mana yang menggerakkan kas di keputusan #1) — PPOB kebetulan jadi contoh
paling jelas karena margin tipis (Rp1.625 dari Rp23.000) membuat jeda
waktu & pemisahannya kontras.

**DIPUTUSKAN: TIDAK "diperbaiki" pakai transfer manual atau akun virtual
provider PPOB.** Pertimbangan: (1) provider PPOB bukan akun lokal yang
dikenal/dipetakan `financial-app`, membuat akun virtual baru untuk ini
menambah kompleksitas yang sengaja dihindari sejak keputusan #1; (2)
butuh deteksi "ini PPOB, bukan penjualan biasa" di level sync — balik
ke masalah "menebak semantik dari data mentah" yang sudah terbukti
rapuh untuk `get_cashflow_allocation`; (3) tidak menyelesaikan jeda
waktu itu sendiri — piutang tetap piutang, tidak bisa digabung jadi 1
transaksi tanpa memalsukan tanggal kejadian. `financial-app` sebagai
pencatat KAS (bukan P&L per-transaksi) memang tidak dirancang untuk
menyatukan cerita income-expense yang berpasangan — itu levelnya
`get_profit_loss`, sudah dibuktikan berbeda dari cashflow di keputusan
#1. Piutang dari transaksi PPOB (mis. milik "Mang Jaja") diperlakukan
SAMA seperti piutang penjualan retail biasa lewat sync AR/AP terpisah
(`get_ar_ap`) — tidak ada logic khusus PPOB di `financial-app`.

## Sync AR/AP — desain implementasi (DIPUTUSKAN, sudah dikodekan)

Detail konkret yang sebelumnya cuma disinggung ("dua kontak lokal
terpisah") sekarang diputuskan lengkap saat implementasi
(`shared/retailku/sync-ar-ap.ts`):

**Kontak: 2 kontak GENERIK gabungan, BUKAN per pihak Retailku.**
Konsisten literal dengan keputusan lama di `retailku-account-mapping.md`
("bukan dipetakan satu-satu, cukup 2 kelompok gabungan") — satu kontak
"Piutang Retailku" menampung SEMUA piutang gabungan, satu kontak "Utang
Retailku" menampung semua utang gabungan. TIDAK ada breakdown per
customer/supplier individual di level kontak lokal.

**Akun debt lokal: DUA field terpisah, dipilih MANUAL oleh user** (bukan
dibuat otomatis) — satu akun `account_type='debt'` khusus piutang, satu
khusus utang, dipilih di tab Konfigurasi (pola sama dengan
`cash_account_id`/`debt_account_id` di `new-debt-form.tsx`). Alasan:
`applyDebtTransaction` mewajibkan `account_id`/`transfer_account_id`
menunjuk ke baris `accounts` (untuk cek `account_type`), BUKAN langsung
ke `contacts` — skema debts SELALU butuh akun perantara, kontak cuma
atribut tambahan (`debts.contact_id`), bukan pengganti akun.

**Idempotency: snapshot PER PIHAK Retailku, migrasi baru
`retailku_ar_ap_snapshot`** (`0018_retailku_ar_ap_snapshot.sql`:
`retailku_party_id` PK, `party_name`, `outstanding_receivable`,
`outstanding_payable`, `updated_at`). `get_ar_ap` adalah SNAPSHOT total
outstanding saat ini (bukan daftar transaksi baru), jadi sync
membandingkan snapshot sekarang vs snapshot TERAKHIR per pihak, insert
`debts` HANYA untuk SELISIH POSITIF (piutang/utang baru netto sejak
sync terakhir) — `source_ref` = `{tanggal}:{retailkuPartyId}:receivable`
atau `:payable`. Dihitung PER PIHAK dulu (bukan langsung dari total
gabungan `totalReceivable`/`totalPayable`) — kalau dibandingkan dari
total gabungan saja, pelunasan satu pihak bisa "menutupi" utang baru
pihak lain yang kebetulan terjadi di periode sync yang sama (net
berubah jadi 0 padahal ada 2 kejadian ekonomi nyata yang seharusnya
tercatat terpisah). Snapshot per pihak murni state internal untuk
deteksi selisih — TIDAK jadi sumber kontak (tetap digabung ke 2 kontak
generik di atas).

**Delta NEGATIF (piutang/utang berkurang) SENGAJA tidak memicu apa
pun** — sync ini HANYA bertanggung jawab mencatat piutang/utang BARU
yang muncul di Retailku (`debtAction` selalu dipaksa `null` untuk
piutang/`'payable'` untuk utang, TIDAK PERNAH `'settlement'`).
Pelunasan piutang/utang lokal (termasuk yang asalnya dari sync ini)
tetap lewat jalur manual yang sudah ada (tombol "Bayar" di `/debts`,
atau form transaksi transfer debt→cash biasa) — snapshot tetap
di-update ke nilai terbaru supaya sync berikutnya membandingkan dari
titik yang benar, tapi TIDAK ada logic "deteksi pelunasan otomatis" di
sync ini sendiri.

## Bug ditemukan live: BEGIN/COMMIT manual bikin "database is locked" — DIPERBAIKI pakai rollback manual

Saat tombol "Sync Sekarang" pertama kali dicoba live di `tauri dev`,
muncul error `Sinkronisasi Retailku gagal... error returned from
database: (code: 5) database is locked`. Diteliti: `@tauri-apps/
plugin-sql` memakai CONNECTION POOL di balik layar (`close()`
dokumentasinya sendiri bilang "Closes the database connection pool") —
tiap panggilan `execute()`/`select()` bisa jatuh ke koneksi fisik SQLite
BERBEDA. `BEGIN` yang dijalankan di satu `execute()` call TIDAK
menjamin `INSERT` berikutnya jalan di koneksi yang sama, jadi transaksi
SQLite (yang terikat per-koneksi) tidak pernah benar-benar terbentuk
dengan benar — malah dua koneksi saling kunci.

Dikonfirmasi via riset (WebSearch + WebFetch ke GitHub): ini keterbatasan
DIKETAHUI di plugin resmi Tauri, bukan salah implementasi —
`tauri-apps/plugins-workspace` issue #886 ("[sql] Add support for
transactions", dibuka Januari 2024) melaporkan persis masalah yang sama
(manual `BEGIN`/`ROLLBACK` tidak bekerja seperti diharapkan), BELUM ada
fix resmi dari tim Tauri per tanggal dokumen ini ditulis.

**Solusi yang diputuskan: ROLLBACK MANUAL (DELETE eksplisit), BUKAN
BEGIN/COMMIT/ROLLBACK SQL asli** — mempertahankan semangat
all-or-nothing yang sudah disepakati, diimplementasikan lewat cara yang
benar-benar didukung plugin ini:
- `syncCashflow()`/`syncArAp()` SEKARANG mengembalikan
  `insertedSourceRefs` (daftar `source_ref` yang BERHASIL di-insert),
  bukan cuma hitungan. `syncArAp()` juga mengembalikan
  `touchedPartyIds`/`previousSnapshotsById` (snapshot AR/AP SEBELUM
  sync ini, untuk restore).
- `syncAll()` (`shared/retailku/sync-all.ts`) menjalankan cashflow lalu
  AR/AP seperti biasa (TANPA `BEGIN`). Kalau SALAH SATU melempar error,
  `catch` block menjalankan `DELETE` manual untuk SEMUA `source_ref`
  yang sudah ter-insert dari KEDUA jalur (termasuk jalur yang sudah
  sukses duluan), plus `rollbackArApSnapshots()` untuk mengembalikan
  `retailku_ar_ap_snapshot` ke nilai sebelum sync.
- **Detail kritis**: `debts.transaction_id` pakai `ON DELETE SET NULL`
  (bukan CASCADE, lihat `0012_debts.sql`) — `DELETE FROM transactions`
  SAJA tidak ikut menghapus `debts`/`debt_payments` terkait, cuma
  membuat `transaction_id`-nya jadi NULL (piutang/utang "yatim" tanpa
  jejak). Rollback HARUS hapus `debts` dulu secara eksplisit (dengan
  subquery `WHERE transaction_id IN (SELECT id FROM transactions
  WHERE source_ref IN (...))`) SEBELUM hapus `transactions`-nya —
  `debt_payments` ikut terhapus otomatis lewat CASCADE dari `debts`.

**Trade-off yang disadari**: ini BUKAN atomicity sungguhan di level
database (tidak ada isolation dari transaksi konkuren lain yang
mungkin baca data "setengah jalan" di antara insert dan rollback) —
untuk aplikasi desktop single-user tanpa akses konkuren, risiko ini
diterima sebagai satu-satunya cara praktis mencapai semangat
all-or-nothing dengan plugin yang tersedia. Diverifikasi
`tsc`/`npm test` (94/94)/`npm run build` bersih setelah perbaikan —
BELUM dicoba ulang live di `tauri dev` untuk konfirmasi bug ini benar-
benar teratasi (lihat TODO "verifikasi live" di bawah).

## TODO

- [x] ~~Validasi prasyarat mapping sebelum sync bisa aktif: semua baris
      `retailku_account_mapping` harus `local_account_id` yang SAMA.~~
      **DIBATALKAN** — keputusan #2 DIREVISI TOTAL (lihat di atas):
      cashflow sekarang sync per akun kas Retailku sendiri-sendiri,
      tidak ada lagi "satu akun tujuan gabungan" untuk divalidasi
      seragam. Tab Konfigurasi cuma menampilkan info jumlah mapping yang
      ADA (bukan validasi keseragaman) — lihat `cashflow-config-tab.tsx`.
- [x] Sub-tab baru "Utang Piutang" di `CashflowSyncPanel`
      (`/retailku/cashflow`) — `getArAp()` di `retailku-mcp-client.ts`
      (panggil `get_ar_ap`, TANPA `dateFrom`/`dateTo` karena snapshot,
      bukan rentang), hook `useRetailkuArAp()` di
      `use-retailku-cashflow.ts`, komponen `features/retailku/ar-ap-tab.tsx`
      — tabel pihak (nama, badge tipe Pelanggan/Pemasok, outstanding
      piutang, outstanding utang) + total piutang/utang di atas tabel.
      Read-only murni, sama seperti 3 sub-tab lain, tidak terpengaruh
      input rentang tanggal panel (sesuai desain). Diverifikasi
      `tsc`/`npm test` (94/94)/`npm run build` bersih DAN dikonfirmasi
      live di `tauri dev` — baris "Mba-mba Kado Kuning" (Pemasok, utang
      Rp3.000) cocok persis dengan panggilan `get_ar_ap` langsung ke MCP
      yang sudah dicek sebelumnya di sesi ini.
- [x] Migrasi SQL: kolom `source` (`'manual' | 'retailku_sync'`,
      default `'manual'`) dan `source_ref` (nullable) di `transactions`
      — dibuat di `apps/desktop/src-tauri/migrations/0017_transaction_source.sql`
      (belum di-commit ke git saat catatan ini ditulis). Sesuai desain:
      `CHECK (source IN ('manual', 'retailku_sync'))`, plus
      `CREATE UNIQUE INDEX idx_transactions_source_ref ON
      transactions(source, source_ref) WHERE source_ref IS NOT NULL`
      untuk cek idempotency cepat sekaligus mencegah baris dobel.
- [x] Fungsi sync inti — DUA jalur untuk cashflow (lihat keputusan #6
      DAN #2 revisi): `shared/retailku/sync-cashflow.ts`. KEDUA mode
      (ringkas & detail) sekarang SAMA-SAMA bersumber dari
      `get_cashflow_detail` (BUKAN `get_cashflow_summary` lagi) —
      - Mode ringkas: agregasi per `(tanggal, accountId Retailku)`,
        `source_ref` = `{tanggal}:{accountId}`.
      - Mode detail: agregasi per `(tanggal, accountId, sourceType)`,
        `source_ref` = `{tanggal}:{accountId}:{sourceType}`.
      Tiap baris di-insert ke akun LOKAL sesuai `retailku_account_mapping`
      milik `accountId` itu sendiri (bukan satu akun gabungan) — akun
      yang belum dipetakan di-skip + dikumpulkan di `unmappedAccountIds`
      (dilaporkan via toast, TIDAK menggagalkan sync). Untuk kedua mode:
      skip `source_ref` yang sudah ada (idempotency). `shared/retailku/
      sync-ar-ap.ts` untuk AR/AP (lihat "Sync AR/AP — desain
      implementasi"). `shared/retailku/sync-all.ts` menggabungkan
      keduanya dalam SATU database transaction BEGIN/COMMIT/ROLLBACK
      all-or-nothing (raw SQL manual — `@tauri-apps/plugin-sql` tidak
      punya API transaction bawaan). Diverifikasi `tsc`/`npm test`
      (94/94)/`npm run build` bersih.
- [x] Isi tab "Konfigurasi" di `CashflowSyncPanel` (`/retailku/cashflow`)
      — `features/retailku/cashflow-config-tab.tsx`: info jumlah
      mapping (BUKAN validasi keseragaman, lihat item pertama di atas),
      toggle mode, field "Akun Kas untuk Utang Piutang" (combobox akun
      `cash`, independen dari mapping cashflow), dua field "Akun untuk
      Piutang"/"Akun untuk Utang" (combobox akun `debt`), field "Titik
      Awal Sync" (`Input type=date`, bisa diedit manual), toggle "Sync
      Otomatis Saat App Dibuka", status sync terakhir, tombol "Sync
      Sekarang" (`useSyncRetailkuAll`, disabled sampai semua field
      terisi + kredensial Retailku lengkap). Trigger OTOMATIS saat app
      dibuka BELUM diwire (perlu titik masuk terpisah, mis.
      `AppSidebar`) — tab ini baru menyediakan pengaturannya
      (`autoSyncEnabled`, dst), belum ada yang MEMBACA setting itu untuk
      benar-benar memicu sync otomatis. TIDAK ada halaman/route/item
      sidebar baru (direvisi dari rencana awal, lihat catatan revisi di
      #3). Diverifikasi `tsc`/`npm test`/`npm run build` bersih.
- [ ] **BELUM**: titik masuk trigger OTOMATIS saat app dibuka (baca
      `autoSyncEnabled`/`lastAutoSyncDate` dari settings, panggil
      `syncAll()` kalau syarat 1x/hari terpenuhi, tampilkan toast kalau
      gagal) — lihat "Pertanyaan terbuka #2". Field-field pengaturannya
      sudah ada (item di atas), TAPI belum ada kode yang benar-benar
      memicunya secara otomatis.
- [x] Verifikasi LIVE di `tauri dev` — DIKONFIRMASI BERHASIL (2026-09-21
      malam, database `finance.dev.db` + WAL). Migrasi `0018` jalan
      sukses (`_sqlx_migrations` versi 18, `success=1`). Tombol "Sync
      Sekarang" (mode ringkas, titik awal "2026-09-01") menghasilkan:
      - 41 transaksi cashflow, rentang 2026-09-01 s/d 2026-09-21, MASING-
        MASING akun kas Retailku (Seabank/Kas Tunai) ke akun LOKALNYA
        SENDIRI (id 44 "Kantong Utama"/id 51 "Dompet Bisnis") — bukan
        digabung ke satu akun, sesuai keputusan #2 revisi.
      - 5 transaksi transfer AR/AP (4 piutang baru + 1 utang baru),
        semua ber-`contact_id` mengarah ke kontak generik "Piutang
        Retailku"/"Utang Retailku" sesuai desain.
      - 5 baris `debts` baru (id 11-15) lahir otomatis lewat
        `applyDebtTransaction`, `transaction_id` terisi benar,
        `status='ongoing'` — persis pola yang sudah teruji untuk input
        manual, dikonfirmasi bekerja sama untuk sync.
      - `retailku_ar_ap_snapshot` terisi 5 baris (1 per party) dengan
        nilai outstanding terkini.
      TIDAK ADA error "database is locked" — perbaikan rollback manual
      (lihat "Bug ditemukan live" di atas) berhasil menghindari masalah
      connection pool. Jalur ROLLBACK ITU SENDIRI (saat salah satu jalur
      benar-benar gagal di tengah) BELUM sempat teruji live — sync
      pertama ini langsung sukses penuh, tidak ada skenario gagal yang
      terpicu secara alami untuk diverifikasi.

## Bug ditemukan live #2: field akun/mode di tab Konfigurasi TIDAK tersimpan — DIPERBAIKI

Setelah sync pertama berhasil (di atas), user menutup lalu membuka lagi
tab Konfigurasi — Titik Awal Sync (yang memang tersambung ke `settings`)
tetap benar, TAPI field "Akun Kas untuk Utang Piutang", "Akun untuk
Piutang", "Akun untuk Utang", dan toggle Mode Sync semuanya KEMBALI KE
KOSONG/DEFAULT, padahal sebelumnya sudah dipilih dan sync sempat
berjalan sukses memakainya.

**Root cause**: `mode`/`arApCashAccountId`/`receivableDebtAccountId`/
`payableDebtAccountId` di `cashflow-config-tab.tsx` SEMPAT cuma
`useState` lokal murni — TIDAK PERNAH ditulis ke `settings` sama sekali,
beda dari `syncFrom`/`autoSyncEnabled` yang dari awal sudah benar
tersambung ke `useRetailkuCashflowSyncSettings`. State React lokal
hilang begitu komponen unmount (pindah tab lain di `Tabs`, atau
navigasi keluar halaman) — murni oversight implementasi, bukan masalah
desain (skema `settings` untuk `syncMode` bahkan SUDAH ada dari awal,
cuma lupa dipakai).

**Perbaikan**: tambah TIGA key `settings` baru di
`use-retailku-cashflow-sync-settings.ts` — `retailku_ar_ap_cash_account_id`,
`retailku_receivable_debt_account_id`, `retailku_payable_debt_account_id`
(pola sama seperti key lain, `INSERT ... ON CONFLICT DO UPDATE`). Field
`syncMode` yang skemanya sudah ada dari awal juga baru SEKARANG benar-
benar dipakai (sebelumnya sama-sama diabaikan, tertutup oleh `useState`
lokal yang tidak sengaja lebih "menang"). `cashflow-config-tab.tsx`
ditulis ulang: SEMUA field baca nilai dari `syncSettings` (query), tulis
langsung lewat `setSyncSettings.mutate()` saat dipilih (bukan
`setState` lokal lalu simpan terpisah seperti pola `syncFromDraft`) —
dropdown/toggle group natural untuk auto-save langsung, beda dari input
teks tanggal yang perlu konfirmasi eksplisit sebelum ditulis.
Diverifikasi `tsc`/`npm test` (94/94)/`npm run build` bersih. BELUM
diverifikasi live ulang (ganti tab lalu kembali, pastikan field
benar-benar persisten) — lihat TODO.

- [x] Penanganan revisi data Retailku setelah sync — DIPUTUSKAN
      diamkan, TIDAK ADA aksi implementasi (lihat "Pertanyaan terbuka
      #4"). Dicatat di TODO ini hanya sebagai jejak bahwa pertanyaan
      ini SUDAH dibahas & sengaja tidak dibangun, bukan terlewat.
- [ ] **BELUM**: verifikasi live ulang untuk "Bug ditemukan live #2" di
      atas — pilih field akun/mode, pindah ke tab lain (mis. tab
      Ringkasan) lalu kembali ke tab Konfigurasi, pastikan nilainya
      TETAP terisi (tidak kembali kosong seperti sebelum diperbaiki).

## Pertanyaan terbuka (BELUM diputuskan — dibahas sebelum implementasi)

**#1. Bagaimana sync tahu tanggal mana yang sudah diproses? — DIPUTUSKAN: gabungan A+B, DENGAN titik awal (B) bisa DIEDIT MANUAL oleh user.**

- **Opsi A — kolom `source`/`source_ref` di `transactions`** (migrasi
  `0017_transaction_source.sql`, sudah dibuat). `source_ref` = tanggal
  ISO (mis. `"2026-09-20"`) untuk mode ringkas, tanggal+sourceType untuk
  mode detail. Sebelum insert per tanggal/baris, cek `SELECT 1 FROM
  transactions WHERE source='retailku_sync' AND source_ref=?` — kalau
  sudah ada, skip. Ini SUMBER KEBENARAN idempotency yang sesungguhnya —
  selalu dicek, apa pun nilai titik awal (B) saat itu, supaya aman
  walau user memundurkan titik awal manual sampai overlap tanggal yang
  sudah pernah disync.
- **Opsi B — "titik awal sync" disimpan di tabel `settings`** (key
  baru `retailku_cashflow_sync_from`, pola KONSISTEN dengan
  `retailku_mcp_url`/`retailku_api_key` yang sudah ada di
  `use-retailku-settings.ts` — key-value biasa, BUKAN tabel/kolom baru).
  Fungsinya sebagai OPTIMISASI pencarian titik awal (supaya sync tidak
  perlu `SELECT MAX(source_ref)` dari `transactions` tiap kali jalan),
  BUKAN pengganti opsi A.
  - **Default**: tanggal saat mapping akun Retailku pertama kali
    disimpan (`retailku_account_mapping` — momen paling natural yang
    menandai "integrasi Retailku dimulai").
  - **BISA DIEDIT MANUAL oleh user** di tab Konfigurasi (bukan cuma
    nilai tersembunyi yang terus maju otomatis) — untuk kasus user mau
    mulai efektif dari tanggal lain, atau sengaja re-sync ulang dari
    titik lebih jauh ke belakang. Field input tanggal biasa, sama pola
    dengan input rentang tanggal di tab Ringkasan.
  - **Maju otomatis** setelah tiap sync sukses (all-or-nothing, lihat
    "Keterkaitan dengan sync utang-piutang" di atas) — di-set ke
    tanggal terakhir yang berhasil diproses + 1 hari.
- **Ini juga menjawab pertanyaan #5** (batas atas rentang re-sync saat
  offline lama) — karena titik awal dikontrol eksplisit oleh user
  (bukan auto-mundur tanpa batas), tidak perlu batas keras "maks 90
  hari" sebagai pengaman otomatis. Cukup peringatan UI non-blocking
  kalau rentang [titik awal, hari ini] sangat panjang (mis. "rentang
  ini mencakup 120 hari, proses bisa memakan waktu").

**#2. Kapan sync dipicu? — DIPUTUSKAN: KEDUANYA (manual + otomatis).**

- **Manual**: tombol "Sync Sekarang" di tab Konfigurasi (sudah pasti
  sejak awal, lihat #3).
- **Otomatis saat app dibuka**, dengan TIGA pagar (beda karakter dari
  prefetch mapping yang cuma baca — sync ini MENULIS transaksi baru,
  lihat catatan lama di bawah):
  1. **Toggle on/off di tab Konfigurasi** — "Sync otomatis saat app
     dibuka", default menyala, user yang tidak mau kejutan transaksi
     otomatis bisa matikan dan pakai tombol manual saja.
  2. **Dibatasi maksimal 1x per hari** — cek dulu apakah sudah pernah
     sync hari ini (bisa dari `settings` juga, mis.
     `retailku_cashflow_last_auto_sync_date`, atau derivasi dari
     `retailku_cashflow_sync_from` kalau sudah maju sampai hari ini)
     sebelum menjalankan; kalau sudah, skip. Mencegah panggilan MCP
     berulang kalau user buka-tutup app berkali-kali sehari.
  3. **Kegagalan dilaporkan via notifikasi non-blocking** (toast/badge
     di area sidebar Retailku) — BEDA dari sync manual yang errornya
     bisa ditampilkan langsung di tab Konfigurasi tempat tombolnya
     ditekan. Sync otomatis terjadi diam-diam di background, jadi user
     tetap perlu tahu kalau gagal tanpa dipaksa buka tab Konfigurasi
     sendiri — TAPI tidak boleh modal/blocking yang mengganggu alur
     kerja (best-effort, sesuai semangat pola prefetch mapping).

**#3. UI status sync — DIPUTUSKAN (REVISI): tab "Konfigurasi" yang
SUDAH ADA di `/retailku/cashflow` (`CashflowSyncPanel`), BUKAN halaman
`/retailku/sync` terpisah.**

Rencana awal (halaman baru + item sidebar baru "Sync Cashflow") DIGANTI
setelah disadari tab "Konfigurasi" sudah ada sebagai placeholder di
`CashflowSyncPanel` sejak tab "Utang Piutang" dibangun (lihat di atas)
— membuat halaman terpisah berarti DUA tempat navigasi untuk hal yang
sudah saling terkait erat (lihat "Keterkaitan dengan sync utang-piutang"
di atas: satu tombol sync menjalankan cashflow+AR/AP sekaligus, jadi
kontrolnya pun wajar satu tempat dengan tampilan datanya). TIDAK ada
item sidebar baru, TIDAK ada route baru — cukup isi tab yang sudah ada.

Isi tab "Konfigurasi":

- **Status prasyarat mapping** (lihat TODO pertama) — indikator jelas
  kalau `retailku_account_mapping` belum konvergen ke satu
  `local_account_id`, dengan link ke `/retailku/mapping` untuk
  memperbaiki. Tombol "Sync Sekarang" di bawah HARUS disabled selama
  prasyarat ini belum terpenuhi.
- **Toggle mode**, bisa diganti kapan saja (lihat keputusan #6 di
  bawah) — "Mode ringkas" (`get_cashflow_summary`, 1 transaksi/hari)
  vs "Mode detail per kategori" (`get_cashflow_detail`, 1 transaksi per
  `sourceType`/hari). Ganti mode TIDAK mengubah transaksi yang sudah
  tersinkron dengan mode lama (histori dibiarkan apa adanya) — cuma
  memengaruhi sync berikutnya. Toggle ini HANYA memengaruhi jalur
  cashflow — jalur AR/AP selalu ikut disertakan di setiap sync (lihat
  "Keterkaitan dengan sync utang-piutang"), tidak ada toggle terpisah
  untuk AR/AP.
- **Status terakhir**: tanggal terakhir berhasil disinkron, kapan sync
  terakhir dijalankan (berhasil/gagal). Karena mode kegagalan
  ALL-OR-NOTHING (lihat di atas), ini SATU status gabungan
  cashflow+AR/AP, bukan dua status terpisah.
- **Tombol "Sync Sekarang"** (manual trigger) — lihat keputusan #2 di
  bawah, ini SATU dari kemungkinan dua trigger, bukan satu-satunya.
  Memicu kedua jalur (cashflow + AR/AP) dalam satu database transaction
  — pesan error harus jelas kalau all-or-nothing gagal (mis. "Sync
  gagal, tidak ada perubahan disimpan").

Pertanyaan turunan yang masih terbuka: apakah transaksi hasil sync
perlu ditandai visual berbeda di daftar transaksi biasa (lihat
`source` di atas — badge "Dari Retailku" mis.)? Apakah user bisa
edit/hapus transaksi hasil sync secara manual, dan kalau ya, apa
efeknya ke idempotency (akan disinkron ulang jadi dobel, atau
`source`-nya berubah jadi manual begitu diedit)?

**#4. Bagaimana kalau data Retailku untuk tanggal yang SUDAH tersinkron ternyata berubah? — DIPUTUSKAN: DIAMKAN (tidak ada logic penanganan otomatis).**

Skenario: transaksi hari itu di-void/dikoreksi di Retailku SETELAH
sync sudah mencatatnya di `financial-app`. Dari 3 opsi yang
dipertimbangkan (diamkan / re-check otomatis N hari terakhir tiap sync
jalan / tombol re-check manual terpisah), dipilih **diamkan** — sesuai
opsi A di #1 (`source_ref` sekali tercatat = one-shot, TIDAK ada logic
re-check periodik). Konsekuensi yang disadari dan diterima: kalau
Retailku merevisi transaksi di tanggal yang sudah tersinkron, transaksi
lokal jadi "stale" (tidak lagi mencerminkan angka Retailku terkini)
sampai user sadar dan mengoreksi MANUAL (edit langsung transaksi hasil
sync di `financial-app`, seperti transaksi manual biasa). Dipilih
sengaja demi kesederhanaan versi awal — kalau nanti ternyata sering
jadi masalah nyata, opsi 2/3 di atas bisa dipertimbangkan sebagai
fitur lanjutan terpisah, BUKAN dibangun sekarang secara preventif.

**#5. Rentang waktu re-sync saat offline lama? — SUDAH DIJAWAB, lihat #1.**

Tidak perlu batas atas keras (mis. "maks 90 hari") — titik awal sync
dikontrol eksplisit oleh user via `settings.retailku_cashflow_sync_from`
(bisa diedit manual di tab Konfigurasi, lihat #1), bukan mundur otomatis
tanpa batas. Cukup peringatan UI non-blocking kalau rentang yang akan
diproses sangat panjang.

**#6. DIPUTUSKAN: kedua mode didukung, dipilih via toggle di halaman sync (#3).**

Dengan `get_cashflow_detail` (baru dibangun & dikonfirmasi live, lihat
di atas), breakdown granular per `sourceType`/transaksi individual jadi
mungkin tanpa `get_journal_list`/`get_journal_detail` yang berat.
Daripada memilih satu pendekatan secara permanen, **halaman
`/retailku/sync` punya toggle mode** (lihat #3):

- **Mode ringkas** (`get_cashflow_summary`) — 1 transaksi/hari, cepat
  dan ringan, ini yang jadi default.
- **Mode detail per kategori** (`get_cashflow_detail`) — 1 transaksi
  per `sourceType`/hari (mengagregasi baris-baris detail yang
  `sourceType`-nya sama), mendekati pola histori manual Money Manager
  ("Omzet Dagang", "Pembelian Stok", dst) yang jadi motivasi awal
  fitur ini — lebih berat (perlu pagination, agregasi manual per
  `sourceType` di sisi `financial-app`) tapi lebih granular.

Implikasi desain: fungsi sync inti (TODO) perlu 2 jalur pemrosesan
(ringkas vs detail) yang menghasilkan bentuk `source_ref` BERBEDA —
mode ringkas `source_ref` = tanggal saja (`"2026-09-20"`), mode detail
`source_ref` = tanggal + sourceType (mis. `"2026-09-20:SALE"`) supaya
idempotency (#1) tetap benar per baris, bukan per hari, saat mode
detail dipakai. Beralih mode di tengah jalan TIDAK menghapus/mengubah
histori transaksi dari mode sebelumnya (dicatat di #3).

## Verifikasi ulang (2026-09-21)

Seluruh klaim di dokumen ini dicek ulang terhadap kondisi kode aktual
(bukan cuma dipercaya dari catatan sebelumnya):

- Tool `get_cashflow_detail`/`get_cashflow_summary`/`get_cashflow_allocation`
  dikonfirmasi LIVE di MCP "Warung Aqil" — deskripsi & parameter
  (`dateFrom`/`dateTo`/`timezone`, plus `page`/`limit` untuk detail)
  cocok persis dengan yang didokumentasikan di atas.
- `retailku-mcp-client.ts`, `use-retailku-cashflow.ts`,
  `cashflow-sync-panel.tsx`, `cashflow-summary-tab.tsx`,
  `cashflow-allocation-tab.tsx`, `cashflow-detail-tab.tsx` — semua ada
  dan bentuknya cocok dengan deskripsi (tab Ringkasan/Konfigurasi + 3
  sub-tab, tab Konfigurasi masih placeholder).
- Bug fix `date-only` ada di `lib/format-date.ts` dan dipakai di
  `cashflow-detail-tab.tsx:53`.
- `tsc --noEmit` bersih, `npm test` 94/94 pass, `npm run build` sukses
  dengan 16 route termasuk `/retailku/cashflow` — semua cocok dengan
  klaim sebelumnya.
- Skema `retailku_account_mapping` (migrasi `0016`) dikonfirmasi TIDAK
  punya constraint DB yang memaksa `local_account_id` seragam — validasi
  itu memang masih murni TODO di level aplikasi, bukan sesuatu yang
  terlewat didokumentasikan.
- Satu ketidaksinkronan kecil ditemukan & diperbaiki: migrasi
  `0017_transaction_source.sql` ternyata SUDAH ada di working tree
  (untracked) saat dokumen masih menulis TODO ini sebagai "belum ada
  migrasi konkret" — kemungkinan dibuat setelah dokumen terakhir
  di-update. Sudah ditandai selesai di TODO di atas.

## Di luar cakupan dokumen ini

- Sync utang-piutang bisnis (`get_ar_ap`) — dokumen terpisah, lihat
  catatan di `retailku-account-mapping.md`.
- Detail granular per `sourceType` (seperti histori manual "Omzet
  Dagang"/"Pembelian Stok") — sengaja TIDAK dikejar di fitur ini demi
  akurasi (lihat keputusan #1 di atas). Bisa dipertimbangkan lagi
  sebagai fitur terpisah/lanjutan kalau ternyata dibutuhkan, dengan
  pendekatan berbeda dari filter breakdown yang sudah terbukti rapuh.

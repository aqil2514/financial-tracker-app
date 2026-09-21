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

**2. Akun tujuan: mapping akun Retailku HARUS konvergen ke satu akun lokal.**

`get_cashflow_summary` mengembalikan angka GABUNGAN semua akun kas
Retailku (tidak per-akun) — konsekuensinya, transaksi ringkasan harian
ini cuma bisa dicatat ke SATU `account_id` lokal. Diputuskan: skema
mapping (`retailku_account_mapping`, sudah ada) MEMANG mendukung
banyak akun Retailku → 1 akun lokal (pola "Kas Tunai" + "Seabank" → 1
akun "Dompet Bisnis"), dan itu jadi PRASYARAT sync ini — semua baris
mapping WAJIB mengarah ke akun lokal yang SAMA sebelum sync bisa
jalan. Kalau user memetakan ke akun lokal yang berbeda-beda, sync
ditolak dengan pesan jelas (bukan dipaksa/diam-diam pilih salah satu).

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

## TODO

- [ ] Validasi prasyarat mapping sebelum sync bisa aktif: semua baris
      `retailku_account_mapping` harus `local_account_id` yang SAMA.
      Tampilkan status ini di halaman `/retailku/sync` (lihat #3).
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
- [ ] Fungsi sync inti — DUA jalur untuk cashflow (lihat keputusan #6):
      - Mode ringkas: panggil `get_cashflow_summary` per rentang tanggal
        yang perlu diproses (lihat #1), `source_ref` = tanggal.
      - Mode detail: panggil `get_cashflow_detail` (dengan pagination),
        agregasi per `sourceType` per hari, `source_ref` = tanggal +
        sourceType.
      Untuk kedua mode: skip tanggal/baris yang `source_ref`-nya sudah
      ada (idempotency). DIJALANKAN BERSAMA sync AR/AP (dokumen
      terpisah, lihat "Keterkaitan dengan sync utang-piutang" di atas)
      dalam satu database transaction all-or-nothing — bukan fungsi
      yang berdiri sendiri lagi.
- [ ] Halaman `/retailku/sync` (`features/retailku/`, mengikuti pola
      `/retailku/mapping`) — toggle mode, status terakhir sync, tombol
      "Sync Sekarang". Tambah item "Sync Cashflow" ke grup sidebar
      Retailku yang sudah ada (kondisional, lihat #3).
- [ ] Trigger sync — lihat "Pertanyaan terbuka #2" (tombol manual di
      halaman sync sudah pasti; trigger otomatis saat app dibuka masih
      terbuka).
- [ ] Penanganan revisi data Retailku setelah sync (mis. transaksi
      di-void/dikoreksi setelah tanggal itu sudah tersinkron) — lihat
      "Pertanyaan terbuka #4".

## Pertanyaan terbuka (BELUM diputuskan — dibahas sebelum implementasi)

**#1. Bagaimana sync tahu tanggal mana yang sudah diproses?**

- **Opsi A — kolom `source`/`source_ref` di `transactions`** (kolom
  sudah masuk TODO di atas terlepas dari opsi mana yang dipilih, karena
  berguna juga untuk pelaporan "pisahkan omzet bisnis vs personal").
  `source_ref` = tanggal ISO (mis. `"2026-09-20"`). Sebelum insert, cek
  `SELECT 1 FROM transactions WHERE source='retailku_sync' AND
  source_ref=?` — kalau sudah ada, skip (atau UPDATE kalau `net`
  ternyata berubah, lihat #4). Bisa mendeteksi & mengoreksi ulang
  tanggal yang datanya berubah belakangan.
- **Opsi B — "tanggal terakhir disinkron" di `settings`** (pola
  sederhana yang sudah disinggung di `retailku-integration.md`). Sync
  berikutnya cuma proses tanggal SETELAH nilai itu. Lebih sederhana,
  TAPI tidak bisa mendeteksi kalau data Retailku untuk tanggal yang
  SUDAH lewat titik itu ternyata direvisi (lihat #4) — begitu tanggal
  itu terlewati, tidak pernah dicek ulang lagi.
- Opsi A dan B TIDAK saling eksklusif — bisa dipakai bersama (B sebagai
  optimisasi supaya tidak query rentang tanggal terlalu jauh ke
  belakang tiap sync, A sebagai sumber kebenaran idempotency
  sesungguhnya).

**#2. Kapan sync dipicu?**

Belum dibahas sama sekali. Kandidat: (a) otomatis setiap kali app
dibuka (best-effort, non-blocking, sama seperti pola prefetch mapping
account di `AppSidebar`), (b) tombol manual "Sync Sekarang" di suatu
halaman, (c) keduanya. Perlu diperhatikan: ini BEDA karakter dari
prefetch mapping — prefetch cuma BACA (aman diulang), sync ini
MENULIS transaksi baru (perlu lebih hati-hati soal "berapa kali boleh
otomatis jalan tanpa sepengetahuan user").

**#3. UI status sync — DIPUTUSKAN: halaman `/retailku/sync` tersendiri.**

Mengikuti pola `/retailku/mapping` — grup sidebar "Retailku" (kondisional,
cuma muncul saat terkoneksi) bertambah satu item "Sync Cashflow".
Isinya:

- **Toggle mode**, bisa diganti kapan saja (lihat keputusan #6 di
  bawah) — "Mode ringkas" (`get_cashflow_summary`, 1 transaksi/hari)
  vs "Mode detail per kategori" (`get_cashflow_detail`, 1 transaksi per
  `sourceType`/hari). Ganti mode TIDAK mengubah transaksi yang sudah
  tersinkron dengan mode lama (histori dibiarkan apa adanya) — cuma
  memengaruhi sync berikutnya.
- **Status terakhir**: tanggal terakhir berhasil disinkron, kapan sync
  terakhir dijalankan (berhasil/gagal).
- **Tombol "Sync Sekarang"** (manual trigger) — lihat keputusan #2 di
  bawah, ini SATU dari kemungkinan dua trigger, bukan satu-satunya.

Pertanyaan turunan yang masih terbuka: apakah transaksi hasil sync
perlu ditandai visual berbeda di daftar transaksi biasa (lihat
`source` di atas — badge "Dari Retailku" mis.)? Apakah user bisa
edit/hapus transaksi hasil sync secara manual, dan kalau ya, apa
efeknya ke idempotency (akan disinkron ulang jadi dobel, atau
`source`-nya berubah jadi manual begitu diedit)?

**#4. Bagaimana kalau data Retailku untuk tanggal yang SUDAH tersinkron ternyata berubah?**

Skenario nyata: transaksi hari itu di-void/dikoreksi di Retailku
SETELAH sync sudah mencatatnya di `financial-app`. Apakah sync
berikutnya harus mendeteksi selisih dan meng-UPDATE transaksi lama
(butuh cek ulang tanggal yang "sudah" tersinkron, bukan cuma yang
baru), atau dibiarkan saja (transaksi lokal jadi "stale" sampai user
sadar dan koreksi manual)? Ini menentukan apakah opsi A di #1 perlu
logic re-check periodik atau cukup one-shot per tanggal.

**#5. Rentang waktu re-sync saat offline lama?**

`retailku-integration.md` sudah menyinggung "cek gap harian... tinggal
perbesar rentang dateFrom/dateTo saat sync berikutnya jalan" — perlu
batas atas yang wajar (mis. maks 90 hari ke belakang) supaya tidak
memanggil `get_cashflow_summary` dengan rentang tidak masuk akal kalau
app tidak dibuka berbulan-bulan.

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

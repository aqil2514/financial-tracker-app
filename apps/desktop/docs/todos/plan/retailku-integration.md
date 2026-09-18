# Rencana Integrasi dengan Retailku

## Latar belakang

Disebutkan eksplisit di `Proposal.docx` (Retailku, section "7. Rencana
Pengembangan", jalur kedua/faktor internal — "rencana yang PASTI akan
dikerjakan dalam jangka menengah, tanpa menunggu sinyal apa pun dari
luar"):

> "...misal tools pencatatan keuangan pribadi yang terintegrasi dengan
> Retailku. Ini bukan ide baru, melainkan kelanjutan dari kebiasaan yang
> sudah berjalan sejak 2022, yaitu pencatatan keuangan pribadi yang
> dilakukan dengan menggunakan Excel. Pada tahun 2024, sempat berpindah
> ke aplikasi eksternal. Semenjak mulai bisnis di tahun 2025, baru pain
> point yang terjadi cukup terasa... Setiap harinya, saya harus input ke
> dua sistem yang berbeda (Retailku dan aplikasi eksternal) agar datanya
> sinkron. Tujuannya sederhana, agar input data ini cukup sekali dan itu
> bisa menjadi satu ekosistem digital yang saling sinkron satu sama
> lainnya."

Jadi `financial-app` (aplikasi ini) BUKAN cuma proyek pencatatan keuangan
personal berdiri sendiri — motivasi jangka panjangnya adalah menggantikan
"aplikasi eksternal" yang disebut di proposal itu, lalu diintegrasikan
dengan Retailku (platform akuntansi/operasional toko multitenant milik
sendiri, stack NestJS + Next.js + PostgreSQL/Prisma) supaya input data
transaksi keuangan pribadi vs bisnis tidak perlu dilakukan dua kali.

## Implikasi untuk arah pengembangan aplikasi ini

Ini BUKAN todo teknis konkret dengan langkah eksekusi — statusnya masih
"arah strategis yang perlu diantisipasi", bukan spesifikasi fitur. Yang
perlu dipertimbangkan ke depan supaya tidak menutup jalan integrasi:

- **Aplikasi ini Tauri (desktop, SQLite lokal)**, Retailku web (NestJS API
  + PostgreSQL, multitenant). Sinkronisasi lintas dua sistem dengan
  arsitektur data yang beda total (lokal-first vs cloud multitenant) akan
  butuh lapisan sync/API tersendiri — belum ada bentuknya sama sekali
  saat ini.
- Skema data aplikasi ini (`transactions`, `accounts`, `categories`,
  dll — lihat migrasi di `src-tauri/migrations/`) kemungkinan perlu
  mapping eksplisit ke skema akuntansi double-entry Retailku (jurnal,
  akun) kalau integrasi nanti benar dibangun — TIDAK berarti skema
  aplikasi ini harus jadi double-entry dari sekarang, sekadar dicatat
  supaya keputusan skema di masa depan tidak mengejutkan.
- Filter/sort/pagination generik (`components/query/`) dan pola
  `useDbMutation`/`useEntityForm` yang sudah dibangun di aplikasi ini
  kemungkinan bisa jadi referensi pola kalau nanti perlu dibuat lapisan
  sync — tapi ini spekulatif, belum ada keputusan konkret.

## Cara integrasinya: MCP CLIENT di financial-app, BUKAN endpoint API baru

Poin penting yang sempat disalahpahami di awal: rencana semula sempat
mengira integrasi ini butuh MINTA RETAILKU BIKIN ENDPOINT REST API BARU
khusus untuk `financial-app` (desain endpoint baru, autentikasi baru,
maintenance API tersendiri di sisi Retailku). TERNYATA TIDAK PERLU —
karena Retailku SUDAH punya MCP server dengan tools yang persis
dibutuhkan (`get_cashflow_summary`, dst), `financial-app` cukup jadi MCP
CLIENT yang memanggilnya, memakai autentikasi OAuth yang sudah ada.
Beban implementasi sepenuhnya di sisi `financial-app` — Retailku TIDAK
PERLU disentuh/dikembangkan sama sekali untuk integrasi ini.

Klarifikasi penting soal "MCP client" ini supaya tidak disalahpahami
sebagai fitur chat/AI: MCP CLIENT DI SINI BUKAN CHAT INTERFACE DAN TIDAK
MELIBATKAN AI/LLM SAMA SEKALI. Ini murni kode Rust/Tauri biasa yang
secara terjadwal (mis. sekali sehari) mengirim HTTP request berformat
JSON-RPC (spesifikasi protokol MCP) ke endpoint MCP Retailku — persis
seperti `fetch()`/`reqwest` ke REST API manapun, cuma format body-nya
mengikuti skema MCP. Tidak ada keputusan real-time yang perlu "dipikirkan"
saat runtime (tool apa yang dipanggil dan kapan sudah "dibekukan" jadi
kode oleh developer sebelumnya), jadi:
- TIDAK ada biaya Claude API/LLM berkelanjutan untuk sync ini.
- TIDAK ada interaksi/chat yang user perlu lakukan — user cuma buka app
  seperti biasa, transaksi ringkasan muncul otomatis di background,
  sama seperti `import_money_manager` sekarang berjalan otomatis begitu
  file dipilih tanpa user perlu paham query SQL di baliknya.
- Beda dengan MCP server `financial-app` sendiri untuk Claude web (lihat
  `mcp-server-for-claude.md`) — itu KASUS BERBEDA yang memang untuk
  dipakai lewat chat AI, sehingga baru di situ Claude berperan sebagai
  MCP client yang "berpikir".

Dicek langsung ke dokumentasi Retailku (`docs.retailku.com`) — MCP
Retailku (lihat juga `mcp-server-for-claude.md`, ide MCP server serupa
untuk aplikasi ini) sudah expose tools:
- `get_cashflow_summary` — "tren arus kas harian: pemasukan, pengeluaran,
  net". Konsepnya SAMA PERSIS dengan
  `dashboard/use-current-month-summary.ts`/`reports/use-monthly-summary.ts`
  di aplikasi ini (income/expense/net per periode).
- `get_cashflow_allocation` — "alokasi arus kas per sumber transaksi
  (penjualan, pembelian, dll)". Konsepnya sama dengan
  `reports/use-category-breakdown.ts` (breakdown pengeluaran per
  kategori) di aplikasi ini.

Kalau MCP server untuk aplikasi ini nanti dibangun (lihat
`mcp-server-for-claude.md`) dengan tools serupa (mis.
`get_personal_cashflow_summary`), Claude yang terhubung ke KEDUA MCP
server (Retailku + aplikasi ini) bisa langsung menjawab pertanyaan
gabungan seperti "berapa total cashflow saya bulan ini, personal +
bisnis?" — TANPA butuh sinkronisasi data lintas sistem sama sekali. Ini
jalur integrasi yang jauh lebih ringan dibanding sync database
langsung: Claude yang menggabungkan hasil dari dua sumber terpisah saat
diminta, bukan kedua sistem yang perlu saling kirim data satu sama lain.

**Tapi ada gap arsitektur mendasar** kalau tujuannya lebih dari sekadar
"Claude bisa jawab gabungan": cashflow Retailku adalah turunan dari
pencatatan DOUBLE-ENTRY (jurnal debit/kredit — lihat `get_journal_list`,
`get_ledger`, `get_trial_balance` di MCP tools Retailku), sedangkan
`transactions` di aplikasi ini masih SINGLE-ENTRY (income/expense/transfer
langsung, bukan jurnal berpasangan). Integrasi yang lebih dalam dari
"tanya-jawab gabungan lewat Claude" — mis. sinkronisasi data langsung
antar sistem — akan butuh mapping single-entry ke double-entry yang jauh
lebih kompleks daripada sekadar menyamakan nama kolom.

**Dikonfirmasi lewat panggilan nyata ke MCP "Warung Aqil"** (toko pribadi
yang sudah pakai Retailku, tersambung sebagai MCP server di sesi ini):

`get_cashflow_summary` mengembalikan bentuk yang SANGAT dekat dengan
`MonthlySummaryRow` di aplikasi ini — array `{date, inflow, outflow,
net}` per hari + `totals` keseluruhan periode. Beda istilah
(`inflow`/`outflow` vs `income`/`expense`) dan granularitas (harian vs
bulanan), tapi konsepnya identik — kalau mau digabung dengan data
`financial-app`, ini cuma butuh normalisasi nama field, bukan perombakan
model data.

`get_cashflow_allocation` TERNYATA jauh lebih dalam dari sekadar
"breakdown per kategori" seperti `category-breakdown-chart.tsx` di
aplikasi ini. Bentuknya: `sourceType` (SALE, OPERATIONAL_EXPENSE,
CASH_OPNAME, INVESTMENT_TRANSACTION, PURCHASE_ORDER, dst) → breakdown per
`accountName` — nama akun COA sungguhan (mis. "HPP (Harga Pokok
Penjualan)", "Persediaan Barang", "Piutang Dagang", "Uang Muka
Pembelian") dengan `net` yang bisa positif/negatif tergantung sisi
debit/kredit akun itu. Ini BUKAN "kategori pengeluaran" sederhana seperti
`categories.name` di aplikasi ini — ini representasi pergerakan akun
neraca/laba-rugi penuh. Membandingkan langsung "kategori Money Manager/
`financial-app`" dengan "accountName Retailku" akan salah kaprah kalau
disamakan begitu saja — keduanya konsep berbeda (kategori pengeluaran
personal vs akun akuntansi formal), bukan sekadar beda penamaan.

## Bentuk konkret yang diinginkan: agregasi harian per sourceType, bukan replikasi jurnal

Setelah didiskusikan lebih lanjut, cakupan yang diinginkan TERNYATA jauh
lebih sederhana dari kekhawatiran "mapping single-entry ke double-entry"
di atas. Bukti pentingnya: pola ini SUDAH dijalankan manual selama ini di
Money Manager — tiap hari dibuat transaksi ringkasan seperti "Omzet
Dagang" (Rp36.000, akun "Dompet Bisnis"), "Pembelian Stok" (Rp34.500,
akun "Dompet Bisnis"), "Penyesuaian" (Rp1.000, akun "Dompet Bisnis") —
lihat screenshot histori transaksi Money Manager. Baris-baris ini persis
berkorespondensi dengan `sourceType` di `get_cashflow_allocation`: SALE →
"Omzet Dagang", DIRECT_PURCHASE → "Pembelian Stok", CASH_OPNAME →
"Penyesuaian", dst.

Jadi yang diinginkan BUKAN mereplikasi jurnal debit/kredit Retailku
detail per akun COA ke `financial-app` (itu levelnya `get_ledger`/
`get_journal_list`, terlalu dalam dan tidak perlu). Yang diinginkan:

1. Tiap hari, `financial-app` cek transaksi dari Retailku (lewat MCP atau
   API langsung) untuk tanggal yang BELUM ada transaksi ringkasannya di
   `financial-app` (deteksi gap harian, bukan re-sync semua histori tiap
   kali).
2. Untuk tiap `sourceType` yang muncul di hari itu (dari
   `get_cashflow_allocation` atau endpoint setara), AGREGASI jadi SATU
   baris transaksi ringkasan per sourceType per hari — bukan satu-satu
   per transaksi detail Retailku.
3. Baris ringkasan itu di-generate otomatis sebagai transaksi biasa di
   `financial-app` (`type`: income kalau net masuk/expense kalau net
   keluar, `amount`: net dari agregasi, `note`/label: nama yang
   merepresentasikan sourceType — mis. "Omzet Dagang" untuk SALE,
   "Pembelian Stok" untuk DIRECT_PURCHASE), dengan `account_id` yang
   diarahkan ke akun KHUSUS bisnis (pola "Dompet Bisnis" yang sudah
   dipakai manual selama ini — bisa jadi account_group tersendiri di
   `financial-app`).

Ini artinya integrasinya JAUH lebih ringan dari yang dikira: single-entry
`financial-app` tidak perlu tahu apa-apa soal debit/kredit/akun COA
Retailku — cukup baca angka net teragregasi per sourceType per hari, lalu
catat sebagai transaksi ringkasan biasa, PERSIS pola manual yang sudah
berjalan, cuma dihilangkan langkah manualnya.

## Kebutuhan skema baru untuk integrasi ini

Dua hal ini butuh perubahan skema `transactions`/`accounts` (belum
didesain detail, baru diidentifikasi kebutuhannya):

**1. Pemetaan akun Retailku → akun `financial-app`.** Retailku
multitenant, satu toko bisa punya banyak akun kas/bank/e-wallet sendiri.
Tidak bisa diasumsikan otomatis 1-ke-1 ke akun `financial-app` — perlu
tabel mapping eksplisit (mis. `retailku_account_mapping`:
`retailku_account_id` ↔ `local_account_id`).

**Dikonfirmasi lewat panggilan nyata ke `get_finance_accounts` (MCP
"Warung Aqil")** — tool ini PROPER untuk kebutuhan mapping: mengembalikan
seluruh Chart of Accounts toko (60+ akun untuk Warung Aqil), tapi yang
relevan untuk mapping cuma akun dengan flag `isPaymentMethod: true` —
field ini secara eksplisit memisahkan akun kas/bank/e-wallet ASLI (tempat
uang benar-benar disimpan) dari akun akuntansi murni (HPP, Persediaan,
Piutang, dst yang bukan tempat uang). Dari 60+ akun Warung Aqil, cuma 2
yang `isPaymentMethod: true`: "Kas Tunai" (code 1101) dan "Seabank" (code
1102) — jauh lebih sedikit dan jelas dari kelihatannya di awal (tidak
perlu memetakan seluruh COA, cukup akun yang berupa payment method).

Field yang dipakai untuk mapping: `id` (UUID stabil, jadi kunci
`retailku_account_id`), `name` (label ditampilkan ke user saat setup
mapping), `code` (opsional, buat referensi kalau user familiar dengan
kode akuntansi). Field `accountMappings`/`role` (mis. `TRADE_RECEIVABLE`,
`INVENTORY`) itu untuk akun sistem otomatis lainnya — tidak relevan untuk
mapping akun kas, aman diabaikan. User yang menentukan pemetaan, mis.
"Kas Tunai dan Seabank keduanya masuk ke akun 'Dompet Bisnis' di sini",
atau kalau mau lebih granular, "Kas Tunai → akun kas lokal, Seabank →
akun bank lokal yang sesuai".

**2. Kolom penanda sumber transaksi (manual vs sinkronisasi).** Perlu
kolom baru di `transactions` (mis. `source: "manual" | "retailku_sync"`,
plus kemungkinan `source_ref` untuk menyimpan identitas unik dari sisi
Retailku — mis. gabungan tanggal+sourceType+storeId) supaya:
- User tahu mana transaksi yang aman diedit bebas (manual) vs yang
  sebaiknya tidak diutak-atik sembarangan karena bisa tertimpa/duplikat
  saat sync jalan lagi.
- Proses sync bisa CEK DULU sebelum insert — kalau baris untuk
  tanggal+sourceType itu sudah pernah dibuat, skip (idempotent), bukan
  bikin baris baru terus tiap kali sync jalan ulang untuk tanggal yang
  sama.
- Berguna juga untuk pemisahan laporan nanti (mis. filter "omzet bisnis
  saja" vs "pengeluaran personal saja" dengan jelas, bukan campur tanpa
  penanda).

Pola "kolom penanda sumber + identitas unik untuk cek duplikat" ini mirip
prinsipnya dengan `import_money_manager` yang sudah ada sekarang (one-time
import), tapi di sini perlu versi yang BERULANG (dijalankan tiap hari),
jadi deteksi duplikat/idempotency jauh lebih penting di sini dibanding
import sekali jalan.

## Constraint desain: online harus opsional, bukan wajib

Aplikasi ini dibangun offline-first (Tauri + SQLite lokal, semua fitur
inti jalan tanpa internet). Integrasi Retailku TIDAK BOLEH mengorbankan
sifat ini — source of truth harus tetap SQLite lokal, integrasi cuma jadi
lapisan tambahan di atasnya, bukan pengganti.

Dua model sync yang kompatibel vs tidak kompatibel dengan offline-first:
- **Sync satu arah/berkala** (kompatibel) — kirim/tarik data ke/dari
  Retailku sesekali saat ada koneksi, pola "eventually consistent" (mirip
  Obsidian Sync/Notion offline mode). Aplikasi tetap 100% berfungsi tanpa
  internet; sync menyusul begitu online lagi.
- **Real-time dua arah** (TIDAK kompatibel) — butuh koneksi konstan
  supaya data selalu sinkron, ini yang akan merusak sifat offline-first
  kalau dipilih.

Kalau integrasi ini nanti benar dikerjakan, arahnya harus ke sync
satu arah/berkala, bukan real-time dua arah, supaya aplikasi tetap bisa
dipakai penuh tanpa internet seperti sekarang.

**Konfirmasi: pola "agregasi harian per sourceType" di atas SESUAI
constraint ini** — arahnya cuma satu (Retailku → `financial-app`, tidak
pernah sebaliknya), sifatnya PULL sesekali (bukan koneksi yang harus
selalu terbuka), dan "cek gap harian" secara desain sudah menangani kasus
offline berhari-hari (tinggal perbesar rentang `dateFrom`/`dateTo` saat
sync berikutnya jalan, tidak ada data yang hilang). Kalau hari ini
offline, transaksi ringkasan hari itu cuma tertunda tercatat — semua
fitur lain (input manual, laporan, filter) tetap 100% berfungsi seperti
biasa, dan begitu online lagi sync otomatis mengejar ketertinggalan.
Satu-satunya state baru yang dibutuhkan: "tanggal terakhir yang sudah
disinkron", disimpan lokal di SQLite seperti data lainnya — bukan
dependency ke server luar untuk itu.

## Catatan

Proposal secara eksplisit menyebut rencana ini masuk jalur yang PASTI
dikerjakan (bukan jalur eksternal yang menunggu sinyal), tapi tidak ada
tenggat waktu spesifik disebutkan — hanya "jangka menengah". Dokumen ini
dicatat supaya konteks strategis ini tidak hilang dan bisa jadi
pertimbangan kalau ke depan ada keputusan arsitektur besar (skema
database, format export/import data, dll) yang berpotensi mempermudah
atau mempersulit integrasi nanti — bukan untuk dieksekusi sekarang.

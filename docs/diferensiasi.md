# Diferensiasi `financial-app`

> Dokumen ini merangkum apa yang membedakan `financial-app` dari aplikasi
> pencatatan keuangan pribadi yang sudah ada (acuan utama: **Money
> Manager**, aplikasi yang sebelumnya dipakai dan datanya diimpor ke
> aplikasi ini — lihat `internal/backups/`). Proyek ini portofolio-only,
> jadi diferensiasi di sini soal kualitas produk & teknik, bukan strategi
> monetisasi.

## Status per platform

- **Desktop** (`apps/desktop`, Tauri + Next.js) — platform utama, paling
  matang. Semua fitur di bawah ini dibangun & diverifikasi di sini.
- **Mobile** (`apps/mobile`, Expo/React Native) — **belum selesai**, baru
  skeleton project (`App.tsx`, belum ada fitur). Rencana awal ada di
  `finance-app-plan.md` (fitur core, AI assistant, dst) tapi belum
  diimplementasikan. Jangan asumsikan paritas fitur dengan desktop.

## 1. Utang-piutang sebagai entitas, bukan sekadar transaksi

**Masalah nyata di Money Manager**: utang-piutang cuma bisa dicatat lewat
akun virtual (mis. akun "Piutang" bertag) yang ditransfer masuk/keluar.
Tidak ada rangkuman "si X total masih pinjam berapa ke saya sekarang" —
kalau ditanya langsung, harus dihitung manual di luar app.

**Pendekatan `financial-app`**:
- Tabel `debts`/`debt_payments` terpisah dengan lifecycle sendiri
  (`ongoing` → `paid`/`written_off`), bukan cuma akun virtual.
- **Dideteksi otomatis dari arah transfer** (kas ↔ akun bertipe `debt`) —
  bukan form terpisah yang harus diingat-ingat untuk diisi. Transfer biasa
  yang sudah jadi kebiasaan lama tetap jalan seperti biasa, sistem yang
  menafsirkan.
- **Kontak sebagai entitas umum** (`contacts`), bukan teks bebas —
  ditemukan dari data nyata bahwa nama yang sama ditulis tidak konsisten
  ("Mama Minjem" vs "mama balikin"), yang akan memecah rangkuman per
  orang kalau tetap pakai teks bebas.
- Pelunasan mendukung **multi-piutang sekaligus** dengan alokasi FIFO
  otomatis (piutang terlama dilunasi duluan), termasuk pembayaran
  sebagian (cicilan).
- Halaman `/debts`, `/debts/receivables`, `/debts/payables` menjawab
  langsung pain point: ringkasan per kontak, siapa berutang/dipinjami
  berapa, kapan pun dilihat — tanpa hitung manual.

**Terverifikasi di database production** (`finance.db`, dicek 2026-09-27,
bukan cuma `finance.dev.db`) — fitur ini sudah dipakai untuk mencatat
data finansial riil, bukan cuma demo/uji coba yang ditinggal:
- 5 baris `debts` (semua `type='receivable'`), 3 baris `debt_payments`.
- Status campuran: 2 sudah `paid` (Kak Ipit Rp196.243, Mama Dicky
  Rp150.000), 3 masih `ongoing` (2 piutang Nde Munan total Rp4.000.000,
  1 piutang baru Mama Dicky Rp300.000) — bukti lifecycle status
  benar-benar dipakai, bukan cuma satu snapshot statis.
- 3 akun `account_type='debt'` yang dipakai (Keluarga, Orang Lain,
  Bisnis) adalah akun virtual LAMA yang sama persis dengan yang dulu
  dipakai manual di Money Manager (lihat "Masalah nyata" di atas) — jadi
  transisinya alami, bukan alur baru yang harus dipelajari ulang.

**Batas penting soal apa yang dibuktikan data ini**: ini membuktikan
fitur *berfungsi dan dipakai sungguhan* — kematangan produk naik dari
"sudah diuji" jadi "sudah dipakai nyata". Ini **tidak** menambah bukti
baru untuk klaim diferensiasi terhadap kompetitor — klaim itu tetap
berdiri di atas bukti yang sudah ada (pola 70 transaksi "minjem"/
"balikin" yang terjebak tanpa rangkuman di Money Manager). Kedua hal ini
dijaga tetap terpisah supaya tidak tertukar.

Detail lengkap: `apps/desktop/docs/todos/plan/debt-receivable-tracking.md`.

## 2. Tipe akun (`account_type`) yang mempengaruhi perilaku, bukan cuma label

**Pendekatan umum di aplikasi pencatatan keuangan** (termasuk Money
Manager): akun biasanya cuma punya nama + grup/kategori pengelompokan
bebas (`group_id` di `financial-app` sebelum ini) — sekadar label
kosmetik untuk sortir tampilan, tidak mempengaruhi logic apa pun. Semua
akun (kas, bank, "akun" utang-piutang virtual) diperlakukan identik oleh
sistem: sama-sama cuma penampung saldo lewat transaksi debit/kredit.

**Pendekatan `financial-app`**: `accounts.account_type` (migrasi
`0013_account_type.sql`) adalah kolom yang benar-benar dibaca logic
aplikasi, bukan cuma tampilan. Saat ini ada 2 nilai — `cash` (default,
akun kas/bank biasa) dan `debt` (akun virtual utang-piutang) — dan
**tipe akun ini yang menentukan apakah field kontak wajib diisi, apakah
transfer memicu pembuatan entitas `debts`, dan ke arah mana (piutang
baru vs pelunasan)** (lihat bagian 1). Ini beda mendasar dari sekadar
"kategori akun": mengubah `account_type` sebuah akun mengubah perilaku
form transaksi terkait akun itu.

**Bukti konkret dari kode** (bukan cuma niat di dokumen rencana) —
`account_type` dipakai sebagai *gate* keputusan di tiga fitur berbeda,
bukan satu tempat terisolasi:
- `features/transactions/form/add-edit/hooks/use-transaction-form.ts` —
  `sourceAccount.account_type === "debt"` menentukan field kontak &
  `DebtActionField` muncul atau tidak di form transaksi.
- `features/retailku/sync-cashflow/.../use-sync-prerequisites.ts` —
  akun yang boleh dipetakan sebagai tujuan sync cashflow Retailku
  **difilter** ke `account_type === "cash"` saja; akun `debt` sengaja
  dikecualikan karena secara ekonomi bukan akun kas/bank sungguhan.
- `shared/debts/apply-debt-transaction.ts` — query balik ke DB untuk
  ambil `account_type` tiap transaksi transfer diproses, jadi penentu
  utama alur mana yang berjalan (piutang baru / pelunasan / dilewati
  sepenuhnya untuk kasus `debt↔debt`).

Dua fitur independen (sync Retailku, tracking utang-piutang) sama-sama
bersandar pada satu kontrak (`account_type`) tanpa duplikasi logic
klasifikasi akun masing-masing — tanda desain yang koheren lintas
domain, bukan solusi lokal per fitur.

Beberapa hal lain yang mengiringi desain ini:
- **Constraint di level database** (`CHECK (account_type IN (...))`),
  bukan cuma divalidasi di aplikasi — SQLite tidak izinkan `ALTER` bebas
  ke `CHECK` yang sudah ada, jadi daftar tipe akun sengaja dibuat
  bertahap & hati-hati (nilai baru butuh migrasi "copy-and-rename",
  bukan `ALTER TABLE` sederhana) — trade-off yang diketahui dan diterima
  sejak desain awal (`docs/todos/plan/account-type.md`).
- **Tipe kompleks lain sudah dipetakan sebagai kandidat konkret, belum
  diimplementasikan**: `credit` (limit, tanggal jatuh tempo, bunga),
  `investment` (jumlah unit, harga per unit, return — juga jadi tujuan
  akhir baris `INVESTMENT_TRANSACTION` dari sync Retailku yang untuk
  sekarang masih menumpang di klasifikasi `transfer`, lihat bagian 3 di
  bawah), `forex` (mata uang asal & kurs), `advance`/uang muka (uang yang sudah
  keluar tapi belum jadi biaya, dipicu kebutuhan nyata sync
  `PURCHASE_ORDER` Retailku), dan `third_party`/dana titipan (uang yang
  tercampur fisik di kas tapi bukan milik pemilik akun, dipicu kebutuhan
  nyata `CASH_OPNAME` Retailku). Semua kandidat ini punya sumber
  kebutuhan nyata yang terdokumentasi, bukan spekulasi fitur.
- Tiap tipe kompleks direncanakan punya **tabel detail terpisah**
  (`credit_accounts`, `investment_accounts`, dst) yang mereferensi
  `accounts.id`, sengaja menghindari kolom JSON generik supaya validasi
  SQL untuk data finansial tetap ketat — beda dari pendekatan skema
  fleksibel/NoSQL yang kadang dipakai aplikasi lain untuk field per-tipe
  yang bervariasi.

### Potensi vs realita: tidak semua tipe kandidat punya bobot diferensiasi yang sama

Penting dipisahkan supaya tidak menyamaratakan — kalau kelima tipe
kandidat di atas benar-benar dibangun, kedalaman diferensiasinya
**tidak seragam**:

- **`credit`, `investment`, `forex` — dangkal sebagai diferensiasi**,
  walau tetap berguna. Rencananya baru berupa field tambahan (limit,
  jatuh tempo, bunga / unit, harga, return / kurs). Ini persis fitur
  yang sudah jadi standar di aplikasi finance personal kelas
  menengah-atas (Spendee, Money Lover, YNAB) — kartu kredit dengan
  limit & jatuh tempo, akun investasi dengan return, bukan hal baru.
  Kalau cuma menambah kolom tanpa logic lintas-fitur yang khas, ini
  **mengejar ketertinggalan**, bukan membuat pembeda baru.
- **`advance` (uang muka) dan `third_party` (dana titipan) — berpotensi
  tetap mendalam**. Keduanya bukan "jenis akun" dalam pengertian umum
  (kartu kredit, saham), melainkan **konsep neraca akuntansi** (uang
  keluar tapi belum jadi biaya; uang di kas tapi bukan milik pemilik
  akun) yang lahir langsung dari kebutuhan nyata sync Retailku
  (`PURCHASE_ORDER`, `CASH_OPNAME`). Aplikasi pencatatan keuangan
  personal pada umumnya tidak punya konsep ini sama sekali, karena
  mereka tidak berurusan dengan uang muka pembelian atau dana
  konsinyasi pihak ketiga. Kalau diimplementasikan penuh — bukan cuma
  kolom tambahan, tapi logic realisasi `advance` → beban/persediaan
  saat `PURCHASE_RECEIVING`, dan pemisahan saldo `third_party` dari
  saldo pemilik akun — ini jadi diferensiasi yang sulit ditiru
  aplikasi personal-finance lain, karena mereka tidak punya *alasan*
  domain untuk membangunnya.

Ringkasnya: kedalaman potensi diferensiasi account-type bukan soal
*berapa banyak* tipe yang selesai, tapi **tipe mana** yang selesai.

Secara kematangan: baru 2 dari banyak tipe yang direncanakan sudah
diimplementasikan (`cash`, `debt`) — kredit/investasi/valas belum ada
sama sekali. Diferensiasinya ada di **arsitektur & niat desain**
(tipe akun sebagai penggerak perilaku dengan jejak kebutuhan nyata di
baliknya), bukan di cakupan tipe akun yang sudah jadi.

**Batas klaim yang jujur perlu dipasang di sini**: kekokohan pola ini
baru terbukti untuk 2 nilai, dan `debt` sendiri adalah akun *virtual*
(bukan representasi uang riil) — jenis logic yang relatif sederhana
(flag arah transfer). Belum ada bukti pola "gate lintas-fitur" ini tetap
kokoh saat tipe ketiga yang jauh lebih kompleks (`investment`, dengan
unit/harga/return, bukan cuma boolean-like) benar-benar dibangun. Sampai
itu terjadi, ini masih **potensi arsitektur**, bukan pembuktian yang
selesai — lihat pemetaan kedalaman per tipe kandidat di bagian
"Potensi vs realita" di bawah.

Detail lengkap: `apps/desktop/docs/todos/plan/account-type.md`.

## 3. Sinkronisasi satu arah dari Retailku (bisnis kecil → keuangan pribadi)

Kebutuhan yang tidak ada padanannya di aplikasi pencatatan keuangan
personal pada umumnya: pemilik usaha kecil (warung/toko) yang memakai
Retailku sebagai sistem POS/akuntansi bisnis, tapi tetap butuh cashflow
bisnis itu masuk ke pencatatan keuangan pribadinya (mis. profit yang
ditarik, dana masuk dari operasional toko).

- Sync **satu arah** — Retailku selalu jadi sumber kebenaran, hanya
  menyerap data agregasi cashflow harian (bukan sinkron dua arah dengan
  konflik).
- **Klasifikasi baris cashflow otomatis** berdasar kombinasi `sourceType`
  + flag ekonomi (piutang/utang dagang, payout provider PPOB,
  consignment, transfer, dll) — bukan cuma menyalin mentah. Lihat
  `apps/desktop/docs/reference/retailku-cashflow-row-classification.md`
  untuk detail aturan & bukti dari data nyata.
- Konfigurasi mapping akun/kategori per toko (`sync-cashflow` feature) —
  fleksibel karena tiap toko bisa punya struktur akun yang beda.

Ini bukan fitur generik "import CSV" — ada domain accounting logic
di baliknya (AR/AP, consignment, uang muka pembelian) yang dibangun
khusus dari kebutuhan nyata mengelola Warung Aqil.

## 4. Offline-first sungguhan, dengan rencana multi-device yang sadar trade-off

- Data tersimpan **lokal** (SQLite via Tauri), tidak butuh koneksi untuk
  input/lihat data sehari-hari.
- Rencana sync multi-device (desktop ↔ mobile, lihat
  `apps/desktop/docs/todos/plan/multi-device-sync.md`) secara eksplisit
  membedakan dirinya dari sync Retailku: di sini **dua arah, banyak
  sumber tulis**, sehingga butuh strategi conflict resolution (bukan
  "server selalu benar" seperti kasus Retailku). Trade-off ini didesain
  dari awal, bukan ditambal belakangan.

## 5. Audit histori data, bukan cuma migrasi buta

Saat mengimpor data lama dari Money Manager, dilakukan audit tabel demi
tabel (termasuk tabel yang ternyata tidak terpakai seperti
`FAVTRANSACTION`, `TAG`/`TX_TAG` kosong) untuk memastikan tidak ada data
bermakna yang hilang diam-diam, dan untuk menemukan fitur yang sudah
"dipakai diam-diam" oleh kebiasaan lama tapi belum ada padanannya —
misalnya budget per kategori (lihat
`apps/desktop/docs/todos/plan/budget-feature.md`, belum dibangun, dicatat
sebagai referensi kebutuhan nyata untuk nanti).

## Perbandingan dengan aplikasi populer lain (berbasis pengetahuan umum, bukan pengalaman pakai langsung)

> **Catatan penting soal keandalan bagian ini**: berbeda dari perbandingan
> dengan Money Manager di atas (berbasis data backup nyata & keluhan yang
> benar-benar dialami), bagian ini disusun dari pengetahuan umum tentang
> fitur aplikasi-aplikasi populer berikut — bukan dari pemakaian langsung
> atau audit data. Fitur aplikasi kompetitor bisa saja sudah berubah sejak
> pengetahuan ini terbentuk. Perlakukan sebagai perkiraan arah, bukan
> fakta yang sudah diverifikasi.

Aplikasi pencatatan keuangan personal populer (Wallet by BudgetBros,
Monefy, Spendee, Money Lover, dan sejenisnya) umumnya kuat di:
pencatatan transaksi cepat, kategori & anggaran (budget), grafik/laporan
visual, dan beberapa punya sync cloud multi-device bawaan. Dibanding
kelompok aplikasi ini secara umum:

- **Utang-piutang berbasis kontak dengan lifecycle** (lihat bagian 1) —
  kebanyakan aplikasi populer di atas menangani utang-piutang mirip
  Money Manager: sebagai akun/kategori transaksi biasa, tanpa rangkuman
  per-orang yang punya status (ongoing/lunas/dihapuskan) dan deteksi
  otomatis dari arah transfer. Ini kemungkinan besar tetap jadi
  diferensiasi nyata, karena akar masalahnya sama seperti yang dialami
  di Money Manager.
- **Tipe akun yang mempengaruhi perilaku** (lihat bagian 2) — sebagian
  aplikasi populer punya "jenis akun" untuk keperluan tampilan/ikon (mis.
  kategori "kartu kredit" di UI), tapi umumnya tidak sampai
  mempengaruhi logic form transaksi dengan constraint database formal
  seperti di `financial-app`. Perlu dicatat: aplikasi kelas
  menengah-atas (mis. yang sudah dukung akun kartu kredit dengan limit &
  jatuh tempo secara matang) kemungkinan justru **lebih unggul** dari
  sisi cakupan tipe akun yang sudah jadi — `financial-app` baru punya 2
  tipe berjalan (`cash`, `debt`), diferensiasinya di niat arsitektur,
  bukan cakupan fitur saat ini.
- **Sync dari sistem bisnis pihak ketiga (Retailku)** — ini kasus
  penggunaan yang sangat spesifik (pemilik usaha kecil yang juga pakai
  POS/akuntansi bisnis terpisah) dan kemungkinan besar tidak ada
  padanannya di aplikasi pencatatan keuangan **personal** mana pun,
  karena aplikasi personal umumnya tidak didesain untuk terhubung ke
  sistem akuntansi bisnis eksternal. Diferensiasi ini kemungkinan kuat,
  tapi belum diverifikasi dengan mencoba aplikasi-aplikasi tersebut
  secara langsung.
- **Budget/anggaran** — ini justru area di mana `financial-app` **kalah**
  dari hampir semua aplikasi populer di atas, bukan cuma dari Money
  Manager. Budget per kategori dengan visualisasi progress adalah fitur
  standar di kelas aplikasi ini, bukan pembeda.
- **Sync cloud multi-device** — aplikasi seperti Spendee/Money Lover
  umumnya sudah punya ini sebagai fitur matang (akun cloud, multi-device
  otomatis). `financial-app` baru di tahap dokumen rencana (lihat bagian
  4) — dari sisi kematangan fitur ini, `financial-app` saat ini
  **tertinggal**, bukan unggul.
- **AI assistant berbasis API key milik user sendiri** — beberapa
  aplikasi populer mulai menambahkan fitur AI/insight otomatis, tapi
  umumnya terikat ke layanan/API milik penyedia aplikasi (bagian dari
  model bisnis mereka). Pendekatan "user pakai API key sendiri" (lihat
  `finance-app-plan.md`) berpotensi jadi pembeda dari sisi privasi/kendali
  data — TAPI ini baru rencana, belum diimplementasikan di platform mana
  pun, jadi belum bisa diklaim sebagai keunggulan nyata saat ini.

**Kesimpulan bagian ini**: diferensiasi paling kredibel dari
`financial-app` tetap tiga hal dari bagian 1, 2 & 3 (utang-piutang
berbasis kontak, tipe akun yang mempengaruhi perilaku, sync Retailku) —
semuanya lahir dari kebutuhan nyata yang dialami sendiri. Untuk klaim
yang menyentuh aplikasi populer di luar Money Manager, sebaiknya
diverifikasi dengan mencoba aplikasi tersebut langsung sebelum ditulis
sebagai fakta di materi portofolio manapun.

## Yang belum jadi diferensiasi (transparansi, bukan klaim)

- **Budget/anggaran** — belum ada fitur ini sama sekali; Money Manager
  justru sudah punya (budget per kategori & total, dengan override
  bulanan). Dicatat sebagai gap, bukan keunggulan.
- **Mobile** — belum ada fitur berjalan, baru rencana & skeleton project.
- **AI assistant** — ada di rencana awal (`finance-app-plan.md`) tapi
  belum diimplementasikan di platform mana pun.
- **Multi-device sync** — baru dokumen perencanaan (belum ada
  implementasi/pilihan tooling final antara Turso, PowerSync, atau sync
  engine custom).

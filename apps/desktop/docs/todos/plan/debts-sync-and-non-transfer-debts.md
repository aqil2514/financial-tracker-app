# Brainstorming: Sync `debts` Langsung + Piutang Tanpa Transaksi

> Status: BRAINSTORMING, belum ada keputusan implementasi final. Dicatat
> 2026-10-03 dari obrolan santai setelah insiden data piutang
> dobel/sampah (lihat bawah "Insiden pemicu").

## TODO (ringkas)

- [x] **SELESAI** — Form "Tambah Utang/Piutang" dikasih toggle "Cara
  Mencatat" (Dengan Transaksi Kas / Langsung) — mode `direct` insert ke
  `debts` tanpa transaksi, `account_id`/`transaction_id` NULL. Lihat
  `shared/debts/new-debt-form/`.
- [x] **SELESAI** — Form "Bayar" diperbaiki supaya tidak error utk
  piutang mode `direct` (`debt.account_id === null`): pelunasan dicatat
  sbg transaksi income/expense BIASA (bukan transfer) + `debt_payments`
  insert langsung. Lihat `shared/debts/pay-debt-form/use-pay-debt.ts`.
- [x] **SELESAI, LALU DIREVISI** — Pelunasan tanpa akun kas (barter,
  pemutihan, offset — SATU jalur sama, disimplifikasi 2026-10-03):
  toggle "Cara Menyelesaikan" (Dengan Uang/Tanpa Uang) di form Bayar,
  mode `non_cash`. **Implementasi awal** (TANPA transaksi sama sekali,
  `transaction_id: NULL`) **TERNYATA MENYALAHI**
  `docs/concept/konsep-utang-piutang.md` ("diselesaikan = saldo akun
  mengarah ke nol") — direvisi belakangan (lihat
  `debt-receivable-tracking.md`, sub-poin "Aksi 'Tandai Dihapuskan'")
  supaya TETAP membuat 1 transaksi `expense`/`income` penutup LANGSUNG
  pada `debt.account_id`, KECUALI `account_id` NULL (baris sync
  Retailku — satu-satunya kasus tersisa tanpa transaksi). Lihat
  `shared/debts/pay-debt-form/use-pay-debt.ts`.
- [x] **SUPERSEDED** — ~~`written_off` TIDAK jadi dibangun terpisah,
  `'paid'` + `note` sudah cukup~~ — keputusan ini DIBATALKAN di sesi
  lain: `written_off` AKHIRNYA dibangun sebagai aksi terpisah
  ("Tandai Dihapuskan" di `DebtListTable`, lihat
  `shared/debts/use-write-off-debt.ts` & `debt-receivable-tracking.md`)
  karena secara UX "sisa piutang masih kelihatan aktif" (status
  `'ongoing'` dengan `remaining > 0`) beda dari "sudah selesai/lunas"
  — enum `written_off` yang tadinya "dibiarkan tidak dipakai" sekarang
  benar-benar dipakai.
- [ ] Putuskan: `debts` transfer-based ikut sync-langsung juga, atau
  tetap derivatif + jalur non-transfer sync-langsung berdampingan.
- [ ] Endpoint Worker `/debts` (create/update/delete) — belum ada.
- [ ] Tool MCP baru "create_debt_direct" (opsional, kalau mau diekspos).
- [ ] Cek ulang relevansi 93 baris sampah yang sudah dihapus manual.
- [ ] Putuskan semantik `deleted_at` vs status baru (`voided`/
  `cancelled`) untuk koreksi pencatatan salah — `written_off` DIKELUARKAN
  dari pertanyaan ini (lihat simplifikasi di atas).

## Insiden pemicu

Sesi 2026-10-03: ditemukan 93 baris `debts` sampah (tanpa kontak,
dibuat serentak lewat MCP, kemungkinan hasil testing tool) + beberapa
baris duplikat (piutang yang sama tercatat 2x — sekali `sync_source='pc'`,
sekali `sync_source='mcp'`) di D1 DAN di `finance.db` lokal. Semua
dibersihkan manual lewat `wrangler d1 execute` + SQL langsung ke SQLite
lokal (BUKAN lewat endpoint/UI resmi — lihat catatan "cara tidak ideal"
di bawah).

**Root cause duplikat**: `debts`/`debt_payments` SENGAJA TIDAK di-push
dari PC ke Worker (lihat `apps/worker/docs/todos/done/cloud-sync.md`
baris ~745, alasan: "tidak py padanan di desktop" — `debts` dianggap
derivatif, bukan entitas yang di-CRUD independen). Sebagai gantinya,
`debts` "diturunkan ulang" dari `transactions` di KEDUA SISI secara
independen (`applyDebtTransaction` di PC, versi portnya di Worker) —
pakai ID baru masing-masing. Kalau transaksi penyebabnya sendiri
ter-pull/ter-push lintas sisi, masing-masing sisi menurunkan `debts`-nya
sendiri-sendiri dari transaksi yang SAMA → 2 baris `debts` berbeda ID
untuk 1 piutang yang sama secara logis.

**Bug kedua yang ikut ditemukan** (independen dari root cause di atas,
tapi mem-blur gejalanya): 4 hook baca `debts`
(`use-contact-summary.ts`, `use-ongoing-debts.ts`,
`use-contact-debts.ts`, `use-debts-list.ts`) TIDAK ADA satu pun yang
filter `deleted_at IS NULL` pada subquery `debts`/`debt_payments` —
jadi baris yang sudah di-soft-delete (lewat jalur manapun) tetap
kehitung di UI. **SUDAH DIPERBAIKI** di sesi yang sama (lihat commit
terkait), di luar scope dokumen brainstorming ini.

**Cara pembersihan data yang TIDAK ideal** (dicatat supaya tidak
diulang sebagai kebiasaan): dihapus langsung lewat
`wrangler d1 execute --remote` (UPDATE manual `deleted_at`) dan SQL
langsung ke `finance.db` produksi — bukan lewat endpoint
`DELETE /transactions/:id` yang sudah ada, karena endpoint itu memang
TIDAK didesain untuk menghapus `debts` secara langsung (lihat
"Desain saat ini" di bawah, poin soal `detachDebtForDeletedTransaction`).
Dampak: perubahan ini TIDAK melalui jalur cloud-sync normal, jadi kalau
ada divais lain yang pull di antara waktu manual-fix ini, state-nya bisa
tidak konsisten. Diterima sebagai tindakan darurat sekali pakai, BUKAN
preseden.

## Pertanyaan brainstorming yang memicu dokumen ini

"Memungkinkan tidak kalau debts ini juga dibuat sinkronisasinya?" →
digali lebih lanjut → "Memungkinkan tidak secara pribadi, seseorang bisa
punya utang piutang tanpa adanya transfer uang?"

## Temuan: desain saat ini 100% mengasumsikan piutang = transfer uang

`applyDebtTransaction()` (`apps/desktop/src/shared/debts/apply-debt-transaction.ts`
baris 66): `if (type !== "transfer" || transferAccountId == null) return;`
— TIDAK ADA jalur untuk membuat `debts` tanpa transaksi transfer yang
menyertainya. Pola yang didukung HANYA:

- **cash → debt**: piutang baru (`type='receivable'`).
- **debt → cash** + `debtAction='payable'`: utang baru.
- **debt → cash** + `debtAction='settlement'`: pelunasan piutang existing
  (FIFO, `settleDebtIds`).

Form **"Tambah Utang/Piutang Baru"** (`features/debts/new-debt-form/`,
lihat `debt-receivable-tracking.md` baris ~470-491) SUDAH ADA secara
UX dan TERASA seperti "catat piutang langsung" — tapi di baliknya tetap
`use-create-debt.ts` meng-insert **1 transaksi transfer** (field "Akun
Kas" + "Akun Utang Piutang" wajib diisi). Jadi secara data, TIDAK ada
jalur piutang yang benar-benar lepas dari `transactions`.

`create_transaction` di `apps/mcp-server` (`route.ts` baris ~160-176)
mewarisi batasan yang sama — deskripsi tool-nya eksplisit: "Untuk
catat/bayar piutang-utang, gunakan type=transfer ... plus debtAction &
settleDebtIds". Dugaan kuat: 93 baris sampah kemarin lahir dari
percobaan/testing tool ini yang generate transfer dummy (tanpa kontak
nyata) untuk mensimulasikan banyak piutang, justru KARENA tidak ada
jalur lebih ringkas untuk "catat piutang saja tanpa akun".

## Kasus nyata yang TIDAK tertampung desain saat ini

Piutang/utang yang TIDAK melibatkan transfer uang lewat akun manapun di
app — semuanya valid secara riil, bukan hipotetis:

- Pinjam-meminjamkan uang tunai **di luar app** (uangnya riil berpindah
  secara fisik, tapi tidak pernah tercatat masuk/keluar dari akun
  manapun di aplikasi).
- Utang berupa barang/jasa (konversi ke nilai uang, bukan transfer kas).
- Piutang/utang LAMA yang baru mau dicatat sekarang (tidak ada jejak
  transaksi historisnya untuk direplay).
- Koreksi/opening balance piutang saat pertama kali pakai fitur ini.

## Arah yang disepakati (level brainstorming)

Berlaku untuk KEDUA arah `debts.type` — `receivable` (piutang, orang
lain berutang ke saya) MAUPUN `payable` (utang, saya berutang ke orang
lain). Semua contoh kasus nyata di atas (pinjam tunai di luar app,
barter, piutang lama) berlaku simetris untuk utang juga — misal ngutang
tunai dari teman di luar app, atau utang diikhlaskan oleh pemberi utang.

Model uang yang dikonfirmasi user: **utang/piutang "langsung" murni
informasional** — TIDAK mengurangi/menambah saldo akun manapun saat
dicatat (uangnya memang sudah berpindah di luar sistem, bukan lewat
akun kas di app). **Pelunasannya TETAP lewat transaksi normal** (income
ke akun kas untuk piutang yang dibayar balik, expense dari akun kas
untuk utang yang saya lunasi) karena uang itu REALLY berpindah lewat
suatu akun kas saat dibayar — ini TIDAK berubah dari pola
`debtAction='settlement'`/`'payable'` yang sudah ada sekarang.

Jadi dua jalur hidup berdampingan, untuk KEDUA `type`:

1. **Transfer-based** (SUDAH ADA, tetap dipertahankan) — lahir dari
   transaksi transfer cash↔debt, `debts.transaction_id` SELALU terisi
   saat insert pertama. Cocok untuk kebiasaan lama (akun virtual
   "Keluarga"/"Orang Lain").
2. **Langsung** (BARU, belum diimplementasikan) — insert langsung ke
   `debts` TANPA baris `transactions` apa pun, `transaction_id = NULL`
   SEJAK LAHIR (bukan cuma jadi NULL belakangan seperti kasus delete).
   `account_id` juga NULL (tidak terkait akun manapun). Tidak menyentuh
   saldo. Berlaku sama untuk `type='receivable'` maupun `'payable'`.

## Implikasi ke sync (balik ke pertanyaan awal)

Jalur langsung (poin 2) TIDAK PUNYA transaksi penyebab yang bisa
"direplay" di sisi lain — beda dari jalur transfer-based yang masih
bisa (walau bermasalah, lihat insiden) mengandalkan replikasi
`transactions` lalu re-derive `debts` di kedua sisi. Konsekuensinya:

- **`debts` (minimal untuk kasus non-transfer) WAJIB disync langsung**
  — push/pull by ID yang SAMA, sama seperti `transactions`/`contacts`/
  `accounts` sekarang. Tidak bisa lagi "diturunkan ulang secara
  independen di 2 sisi" untuk kasus ini, karena tidak ada sumber
  (`transactions`) yang sama-sama bisa dibaca kedua sisi.
- Pertanyaan terbuka: apakah piutang transfer-based IKUT dipindah ke
  sync langsung juga (supaya SATU mekanisme konsisten untuk semua
  `debts`, tidak ada 2 jalur sync berbeda tergantung asal piutang), atau
  tetap dibiarkan derivatif seperti sekarang (lebih sedikit perubahan,
  tapi 2 mekanisme berbeda hidup berdampingan selamanya — berisiko bug
  serupa lagi kalau tidak hati-hati).
- Kalau `debts` disync langsung: perlu skema LWW (`updated_at` sudah
  ada dari migrasi 0028), endpoint CRUD `debts` baru di Worker (sekarang
  SENGAJA tidak ada), dan keputusan FK — gimana kalau `debts.account_id`/
  `transaction_id` merujuk baris yang belum ter-push ke sisi lain (mirip
  masalah FK ordering yang sudah pernah ketemu di backfill
  `categories`/`accounts`, lihat `mcp-server-cloud-mirror.md`).

## Sisi sebaliknya: piutang BERKURANG tanpa transaksi keuangan

Pertanyaan lanjutan dari brainstorming yang sama: "secara riil,
memungkinkan jika utang piutang berkurang tanpa adanya aktivitas
transaksi keuangan?" — jawabannya juga YA, dan kasusnya malah lebih
beragam dari sisi penambahan:

- **Dihapuskan/write-off** — orangnya tidak sanggup bayar, piutang
  diikhlaskan. TIDAK ada uang masuk sama sekali, tapi piutang harus
  dianggap "selesai" statusnya.
- **Dibayar pakai barang/jasa** (barter) — nilainya mengurangi piutang
  tapi tidak ada transaksi income yang cocok.
- **Saling kompensasi/offset** — si X berutang ke saya, saya juga
  berutang ke X; dikompensasi tanpa uang berpindah sama sekali.
- **Koreksi pencatatan** — piutang salah catat dari awal (nominal
  kelebihan, dobel — PERSIS kasus insiden pemicu dokumen ini), perlu
  dikurangi/dibatalkan tanpa ada uang yang benar-benar berpindah.

**Temuan penting**: skema `debts.status` SUDAH mengantisipasi sebagian
dari ini — `CHECK (status IN ('ongoing', 'paid', 'written_off'))` di
migrasi (lihat `src-tauri/migrations/`), dan `written_off` bahkan sudah
punya label tampilan (`shared/debts/status-labels.ts`: `"Dihapuskan"`,
variant `"outline"`). **TAPI ini enum yatim** — digrep ke seluruh
`apps/desktop/src`, TIDAK ADA satu pun mutation/form/tombol yang benar-benar
men-set status jadi `written_off`. Kolom dan label sudah disiapkan,
jalurnya tidak pernah dibangun.

Ini relevan LANGSUNG ke insiden pemicu dokumen ini: pembersihan 93 baris
sampah + duplikat kemarin PADA DASARNYA adalah "pengurangan piutang
tanpa transaksi keuangan" (soft-delete `deleted_at`, bukan
`written_off` — beda semantik: `deleted_at` berarti "baris ini salah/
tidak pernah seharusnya ada", `written_off` berarti "piutangnya valid,
tapi diputuskan tidak akan pernah terbayar"). Yang dipakai kemarin
(`deleted_at` manual lewat SQL) secara semantik SUDAH BENAR untuk kasus
itu (data memang sampah) — tapi untuk kasus "piutang valid yang
diikhlaskan", `written_off` adalah status yang tepat, bukan
soft-delete.

### Implikasi tambahan ke sync

Sama seperti penambahan-tanpa-transfer, pengurangan tanpa transaksi
juga butuh jalur yang tidak mengandalkan `transactions` sebagai
perantara:

- **Write-off**: `UPDATE debts SET status='written_off'` langsung, tidak
  ada transaksi apa pun yang tercipta. Kalau `debts` tetap derivatif
  (tidak disync langsung), perubahan status ini TIDAK akan pernah
  sampai ke sisi lain (PC vs D1/MCP) — karena tidak ada `transactions`
  yang bisa "membawa" perubahan ini ikut tersinkron.
  - Ini memperkuat kesimpulan sebelumnya: begitu ada SATU jalur mutasi
    `debts` yang tidak lewat `transactions` (baik nambah maupun
    mengurangi), `debts` sebagai tabel **harus** ikut disync langsung —
    tidak ada cara derivatif menangkap perubahan ini.
- **Koreksi/pembatalan piutang salah catat**: perlu dipikirkan APAKAH
  ini `deleted_at` (soft-delete, piutang dianggap tidak pernah ada) atau
  status baru (`'voided'`/`'cancelled'`, piutang pernah ada tapi
  dibatalkan — beda dari `written_off` yang piutangnya valid tapi tidak
  tertagih). Belum ada keputusan, sekadar dicatat sebagai pertanyaan
  terbuka.

## Progres implementasi: penambahan & pelunasan dengan transaksi non-transfer

**SUDAH DIKERJAKAN** (2026-10-03, sesi yang sama) — 2 dari 3 kategori
gap sudah ditutup:

1. **Penambahan tanpa transaksi** (`new-debt-form`): toggle "Cara
   Mencatat" → mode `direct` insert `debts` langsung, `account_id`/
   `transaction_id` NULL, tidak sentuh saldo apa pun.
2. **Pelunasan tanpa TRANSFER (tapi tetap transaksi keuangan)**
   (`pay-debt-form`): kalau `debt.account_id` NULL (piutang mode
   `direct`), pelunasan dicatat sbg transaksi `income`/`expense` BIASA
   ke akun kas (uang riil masuk/keluar), bukan `transfer` dari akun debt
   virtual yang memang tidak ada untuk piutang jenis ini. `debt_payments`
   di-insert langsung (bukan lewat `applyDebtTransaction`/FIFO, karena
   formnya selalu menargetkan SATU `debts.id`).
   - **Bug yang DICEGAH**: sebelum fix ini, `use-pay-debt.ts` selalu
     memakai `debt.account_id ?? ""` sebagai salah satu sisi transfer —
     untuk piutang `direct` ini akan jadi string kosong, bikin
     `applyDebtTransaction` gagal cari akun atau (lebih buruk) salah
     diam-diam. Ditemukan SEBELUM sempat dipakai user nyata (piutang
     mode `direct` baru dibuat di sesi yang sama).

## Pelunasan tanpa TRANSAKSI KEUANGAN sama sekali (barter, pemutihan, offset)

**BELUM DIKERJAKAN** — beda kategori dari poin 2 di atas (yang masih
menghasilkan transaksi `income`/`expense`). Kasus di sini SAMA SEKALI
tidak ada uang yang berpindah.

**Simplifikasi (disepakati 2026-10-03, setelah draf awal di bawah ini
sempat membedakan 3 jenis terpisah)**: write-off, barter, dan
saling-offset ternyata **identik secara data** — semuanya "kurangi
sisa piutang sejumlah X, TANPA transaksi income/expense/transfer".
Alasannya beda (diikhlaskan vs dibayar barang vs dikompensasi), tapi
alasan itu teks bebas (`note`), bukan kolom/status terpisah. Jadi cukup
**SATU jalur**, bukan tiga:

- Form "Bayar" dapat 1 opsi baru "Selesaikan tanpa uang" (atau toggle
  serupa pola `record_mode` di `new-debt-form`) — field: Nominal +
  Catatan (alasan), TANPA Akun Kas sama sekali.
- `debt_payments` di-insert dengan `account_id = NULL`, `transaction_id
  = NULL` — TIDAK ada baris `transactions` yang tercipta sama sekali
  (beda dari poin 2 "Progres implementasi" di atas yang tetap bikin
  income/expense).
- Nominal < sisa → `debts.status` TETAP `'ongoing'`, sisa berkurang
  (cocok utk barter/offset SEBAGIAN).
- Nominal = sisa → `debts.status` jadi `'paid'`.
- **`written_off` TIDAK PERLU dibangun terpisah** — diputuskan `'paid'`
  sudah cukup utk semua kasus "selesai", apa pun alasannya. Alasan
  (termasuk "diikhlaskan karena tidak sanggup bayar") cukup di `note`
  baris `debt_payments` ini. Enum `written_off` di skema dibiarkan
  seperti sekarang (tidak dipakai), TIDAK perlu dihapus
  (migrasi/CHECK constraint lama) tapi juga tidak perlu diisi jalurnya.

Catatan: "saling kompensasi/offset" (piutang & utang ke kontak yang
sama) secara teknis berarti user input baris ini DUA KALI — sekali di
piutang (kurangi sisa piutang), sekali di utang (kurangi sisa utang) —
masing-masing lewat jalur yang sama ini, bukan satu aksi gabungan
otomatis. Tidak perlu UI/logic khusus utk "deteksi offset" — form yang
sama dipakai 2x secara manual sudah cukup.

## Belum diputuskan / belum dikerjakan

- [ ] Desain final form "Piutang Langsung" (field apa saja, beda UI dari
  form "Tambah Utang/Piutang" yang sudah ada atau toggle di form yang
  sama).
- [ ] Keputusan: `debts` transfer-based ikut pindah ke sync-langsung,
  atau tetap derivatif + jalur non-transfer sync-langsung berdampingan.
- [ ] Skema endpoint Worker `/debts` (create/update/delete) kalau jadi
  disync langsung — belum ada sama sekali saat ini.
- [ ] Update `create_transaction`/tool MCP baru khusus
  "create_debt_direct" kalau jalur ini mau diekspos ke MCP juga (supaya
  Claude bisa catat piutang dari HP tanpa harus bikin transfer dummy).
- [ ] Migrasi data: apakah 93 baris sampah kemarin (yang SUDAH dihapus
  manual) ada relevansinya untuk dicek ulang setelah fitur ini ada, atau
  dianggap selesai (sudah dihapus, tidak perlu di-restore).
- [ ] Bangun jalur `written_off` yang sudah disiapkan skemanya tapi
  belum ada mutation-nya sama sekali — form/tombol "Hapuskan piutang
  ini" di halaman detail kontak atau daftar piutang.
- [ ] Putuskan semantik `deleted_at` vs `written_off` vs kemungkinan
  status baru (`voided`/`cancelled`) untuk kasus koreksi pencatatan
  salah — supaya tidak terulang kebingungan seperti insiden kemarin
  (pakai `deleted_at` manual lewat SQL karena tidak ada jalur resmi).

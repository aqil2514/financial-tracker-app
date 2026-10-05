# Baris `debts` duplikat — desktop dan Worker sama-sama jadi penulis

Bug ditemukan dari **memakai aplikasi ini sendiri** (dogfooding): tab
Ringkasan Kontak menampilkan 3 baris piutang "Kak Ipit" yang identik
(4 Okt 2026, 14.00, Rp 196.243, status "Berjalan", "Belum ada cicilan
tercatat"), padahal cuma ada 1 transaksi transfer yang relevan.

## Bagaimana ketahuan

Diminta mengecek dogfooding terakhir untuk konteks "masalah sync" —
tapi dogfooding terakhir
([2026-10-04-sinkronisasi-saldo-mcp-vs-database.md](2026-10-04-sinkronisasi-saldo-mcp-vs-database.md))
ternyata bug yang berbeda (FK precheck hilang, sudah fixed). Jadi
diinvestigasi dari nol, dibandingkan salinan `finance.db` (desktop,
production build, lewat `sqlite3`) dengan D1 production (lewat
`wrangler d1 execute --remote`, autentikasi OAuth akun Cloudflare —
bukan token `PC_SYNC_TOKEN`/`MCP_SYNC_TOKEN` di `.dev.vars.production`,
yang ternyata tidak dibutuhkan sama sekali untuk akses D1 langsung).

## Data yang ditemukan

Lokal (`finance.db`, 4 baris, SEMUA `deleted_at` kosong):

| id | sync_source | created_at (lokal) | updated_at | transaction_id |
|---|---|---|---|---|
| `01a0ef4c-10dd-...` | pc | 2026-09-21 06:25 | 2026-10-04 11:22 | (transaksi lama, `status=paid`, tidak terkait bug ini) |
| `01a105b7-5aa7-...` | mcp | 2026-10-04 07:11:29 | 07:01:04 | `01a105b7-5449-...` |
| `01a105c2-dab8-...` | pc | 2026-10-04 07:13:38 | *(kosong)* | `01a105b7-5449-...` |
| `01a105c2-e165-...` | mcp | 2026-10-04 07:31:39 | 07:13:40 | `01a105b7-5449-...` |

D1 production: **cuma 1 dari 3 baris itu ada** — `01a105c2-e165-...`,
dan `sync_source`-nya di production adalah `pc` (bukan `mcp` seperti di
salinan lokal). Dua baris lain (`01a105b7-5aa7-...`,
`01a105c2-dab8-...`) tidak pernah ada di D1 sama sekali — murni
artefak lokal.

Transaksi pemicunya (`01a105b7-5449-...`, transfer "Uang Gaji" →
"Piutang", Rp196.243) di production cuma **satu baris**: dibuat
`07:01:04`, diedit sekali jadi `07:13:38`.

## Bukan kasus terisolasi — Wahyu dan Mama Dicky juga kena

Dicek ulang setelah root cause ketemu: pola yang SAMA PERSIS (2 baris
`debts` lokal, `transaction_id` sama, satu `sync_source: pc` satu
`sync_source: mcp`) juga ada di kontak lain yang sama-sama berasal dari
transfer "Uang Gaji" → akun `debt`, di tanggal yang sama
(2026-10-04):

| kontak | transaction_id | amount | baris debts lokal | di production D1 |
|---|---|---|---|---|
| Mama Dicky | `01a105b6-9037-...` | 188.871 | `01a105b6-9057-...` (pc) + `01a105b6-96b8-...` (mcp) | cuma `...96b8` yang ada |
| Wahyu | `01a105b7-edcc-...` | 124.537 | `01a105b7-edd7-...` (pc) + `01a106f6-6aa9-...` (mcp) | cuma `...6aa9` yang ada |
| Kak Ipit | `01a105b7-5449-...` | 196.243 | 3 baris (lihat tabel di atas) | cuma 1 yang ada |

Konsisten: production D1 SELALU cuma punya 1 baris per
`transaction_id` (Worker idempotent terhadap dirinya sendiri — baris
`debts`-nya sendiri tidak pernah dobel di server). Duplikasi 100%
terjadi di SQLite lokal, karena baris versi desktop (`sync_source: pc`,
dibuat SAAT form transfer disubmit) dan baris versi Worker
(`sync_source: mcp` di lokal — label ini cuma berarti "masuk lewat
pull", BUKAN berarti tool MCP dipanggil) hidup berdampingan tanpa
saling tahu.

Kesimpulan: **setiap transaksi transfer cash→debt yang dibuat dari
desktop berpotensi kena duplikasi `debts` lokal**, bukan kasus Kak
Ipit doang — UI Ringkasan Kontak kebetulan belum menampilkan versi
dobel untuk Wahyu/Mama Dicky di screenshot awal (kemungkinan karena
pull kedua terjadi setelah screenshot diambil, atau rendering
kartunya kebetulan menggabungkan keduanya secara visual), tapi
datanya sudah dobel di database lokal.

## Root cause — dua penulis independen untuk `debts`, tanpa dedup

`debts` **bukan** dari jalur push biasa — `cloud_sync_queue.table_name`
cuma punya `transactions, accounts, account_groups, categories,
contacts`, TIDAK ada `debts`. Jadi baris `debts` di desktop SELALU
berasal dari dua sumber yang berjalan independen untuk event yang
sama:

1. **Desktop lokal** —
   [use-create-transaction.ts](../../apps/desktop/src/features/transactions/form/add-edit/hooks/use-create-transaction.ts)
   baris 101-112: begitu baris `transactions` ter-INSERT lokal, langsung
   panggil `applyDebtTransaction` versi desktop
   ([apply-debt-transaction.ts](../../apps/desktop/src/shared/debts/apply-debt-transaction.ts))
   yang INSERT `debts` ke SQLite lokal dengan `id` dari `newId()`
   (client). INI TERJADI SEBELUM transaksi sempat sampai ke Worker.
2. **Worker** — baris 114 (`pushOnWrite`, fire-and-forget) mengirim
   transaksi itu ke Worker. `createTransactionRow`
   ([transactions/service.ts](../../apps/worker/src/modules/transactions/service.ts))
   JUGA memanggil `applyDebtTransaction` versinya sendiri
   ([debts/service.ts](../../apps/worker/src/modules/debts/service.ts))
   yang INSERT `debts` ke D1 dengan `id` dari `uuidv7()` (server) —
   **beda** dari `id` yang sudah dibuat desktop di langkah 1.

Baris `debts` versi desktop (langkah 1) tidak pernah ikut ter-push
(bukan bagian `cloud_sync_queue`) — dia "nebeng hidup" secara lokal
selamanya kecuali dihapus manual. Baris `debts` versi Worker (langkah
2) baru sampai ke desktop lewat **pull-sync**
([pull-sync.ts](../../apps/desktop/src/shared/cloud-sync/pull-sync.ts)
`upsertDebt`), yang UPSERT berdasar `id` — karena `id`-nya beda dari
yang dibuat lokal di langkah 1, pull ini TIDAK menimpa baris lokal,
melainkan **menambah baris baru**. Tidak ada constraint unique pada
`debts.transaction_id` yang bisa mencegah ini.

Baris ke-3 (`sync_source: mcp`, `created_at` lokal `07:11:29`, LEBIH
AWAL dari `updated_at` transaksi `07:13:38`) kemungkinan besar adalah
pull-sync yang terjadi **sebelum** edit transaksi itu selesai —
`debts.transaction_id`-nya tetap merujuk transaksi yang sama, jadi
bukan sumber independen ketiga, melainkan pull lain yang membawa
`id` Worker yang BERBEDA LAGI (kemungkinan dari percobaan push/edit
Worker yang sempat gagal LWW atau retry sisi lain yang tidak
tertangkap `cloud_sync_queue` lokal, karena `debts` memang di luar
jalur itu — belum terkonfirmasi persis jalurnya, cukup dipastikan
BUKAN dari `create_debt_direct`/`create_transaction` MCP yang
dipanggil berulang: hanya ada SATU transaksi transfer Rp196.243 ke
kontak ini di production).

## Kenapa tidak ketahuan dari test/review biasa

- Tidak ada test yang membandingkan hasil `applyDebtTransaction` versi
  desktop vs versi Worker untuk transaksi yang sama — keduanya
  dikembangkan sebagai port satu sama lain (komentar di kedua file
  saling merujuk), tapi tidak ada yang menjamin keduanya TIDAK
  sama-sama jalan untuk event yang sama.
- `debts` sengaja dikeluarkan dari `cloud_sync_queue` (desain: "Worker
  yang menurunkan `debts` dari `transactions`, bukan push mentah") —
  tapi keputusan itu mengasumsikan HANYA Worker yang menulis `debts`,
  padahal desktop diam-diam masih py jalur tulis lokalnya sendiri yang
  tidak pernah dicabut saat cloud sync diaktifkan.
- UI Ringkasan Kontak menampilkan SEMUA baris `debts` yang
  `transaction_id`-nya merujuk transaksi yang sama tanpa dedup
  tampilan, jadi gejalanya langsung terlihat sebagai "3 baris sama
  persis" — tapi tanpa membandingkan `id` dan `sync_source` tiap
  baris di level database, mudah disangka cuma "transaksi dicatat 3x"
  (dugaan awal sebelum investigasi: tool MCP `create_debt_direct`
  dipanggil berulang — TERBANTAHKAN, cuma ada 1 transaksi pemicu).

## Yang BELUM dilakukan (sengaja, sesuai permintaan)

- Data production/lokal belum dibersihkan (baris `debts` duplikat
  masih ada di `finance.db` lokal — lihat juga Mama Dicky & Wahyu di
  atas, bukan cuma Kak Ipit).
- Rencana fix sudah disusun (keputusan: source-based ownership, PC
  jadi penulis `debts`/`debt_payments` untuk transaksinya sendiri —
  REVISI keputusan lama "Worker satu-satunya penulis D1"), BELUM
  diimplementasikan. Detail lengkap:
  [`docs/todos/plan/fix-debts-duplikasi-sync.md`](../todos/plan/fix-debts-duplikasi-sync.md).

## Pelajaran

- Dua implementasi "port persis" dari logic yang sama (desktop vs
  Worker) tetap bisa jadi DUA PENULIS independen kalau tidak ada
  koordinasi eksplisit soal SIAPA yang berwenang menulis tabel
  turunan (`debts`) — port yang identik secara logic tidak menjamin
  idempotent secara SISTEM kalau dijalankan dari dua sisi untuk event
  yang sama.
- Tabel yang sengaja dikeluarkan dari sync queue (`debts` bukan bagian
  `cloud_sync_queue`) butuh didokumentasikan ASUMSI yang
  melandasinya (di sini: "cuma Worker yang menulis") supaya perubahan
  lain di masa depan tidak diam-diam melanggarnya.
- Dugaan awal yang masuk akal ("tool MCP dipanggil berulang") perlu
  diverifikasi ke database transaksional (bukan cuma tampilan UI) —
  production D1 membuktikan HANYA ADA SATU transaksi pemicu, duplikasi
  murni efek samping arsitektur sync, bukan kesalahan input/pemakaian.

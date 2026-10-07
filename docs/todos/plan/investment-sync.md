# Sync Tipe Akun Investasi ke Cloud — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (investment ikut sync cloud, sama seperti transactions/accounts/debts). Lihat [`../README.md`](../README.md) utk penjelasan umum struktur `docs/todos/{plan,done}/` di root repo.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan desain, riset, dan progress implementasi ada di dokumen masing-masing app — JANGAN duplikasi isi ke sini, cukup pointer.

## Status & TODO saat ini (ringkas)

Sisi Worker (Tahap 0-2) SELESAI — skema D1 + logic bisnis penuh (beli+jual) sudah diverifikasi di lokal. Sisi desktop (Tahap 3, migrasi + wiring push) SELESAI juga (2026-10-07) — PC sekarang mem-push ketiga tabel investment ke Worker di SEMUA titik mutasi. MCP (Tahap 4) BELUM dikerjakan. Penjelasan lengkap tiap poin ada di bagian "Latar belakang" dan "Checklist tahapan" di bawah.

- [x] Tipe akun `investment` selesai diimplementasikan penuh di `apps/desktop` (termasuk penjualan/penarikan sebagian), sudah di-smoke-test manual — lihat [`apps/desktop/docs/todos/plan/account-type-investment.md`](../../../apps/desktop/docs/todos/plan/account-type-investment.md).
- [x] Riset peta gap Worker vs desktop — selesai (2026-10-07), lihat ringkasan di bagian "Latar belakang" di bawah.
- [x] Tahap 0 — Keputusan desain scope sync: **replikasi logic penuh** (bukan CRUD data mentah) — lihat bagian "Tahap 0" di bawah.
- [x] Tahap 1 — Migrasi D1 (`schema/0002_account_type_investment.sql`) ditulis + diverifikasi di D1 LOKAL (2026-10-07), lihat bagian "Tahap 1" di bawah. BELUM di-apply ke `--remote`/production — ditunda sampai Tahap 2 (modul `investments/`) siap.
- [x] Tahap 2 — `classifyAccountPair` + modul `investments/` PEMBELIAN **dan** PENJUALAN (average cost, Realized P/L, validasi oversell, settle, delete pending) SELESAI + diverifikasi penuh via `wrangler dev`/`d1 execute --local` (2026-10-07) — lihat bagian "Tahap 2" di bawah utk daftar lengkap + 1 bug nyata yang ditemukan+diperbaiki saat verifikasi.
- [x] Tahap 3 — Desktop: migrasi kolom cloud-sync (`0042`) + wiring `pushOnWrite`/`pushDeleteOnWrite` di SEMUA titik mutasi (10 hook) SELESAI (2026-10-07) — lihat bagian "Tahap 3" di bawah. BELUM diverifikasi end-to-end nyata (itu Tahap 5).
- [ ] Tahap 4 — MCP server: tool investasi baru — belum dikerjakan, belum diputuskan tool apa saja.
- [ ] Tahap 5 — Verifikasi end-to-end (dogfooding nyata) — belum dikerjakan.

## Latar belakang

Tipe akun `investment` sudah selesai diimplementasikan penuh di `apps/desktop` (lihat [`apps/desktop/docs/todos/plan/account-type-investment.md`](../../../apps/desktop/docs/todos/plan/account-type-investment.md)) — termasuk pembelian, penjualan/penarikan sebagian, average cost, Realized/Unrealized P/L, sudah di-smoke-test manual (2026-10-07). Tapi ini **desktop-only**: `apps/worker` (Cloudflare, satu-satunya penulis D1 production) sama sekali belum punya tipe akun `investment` — `AccountType` di sana masih `"cash" | "debt"` — dan `apps/mcp-server` juga belum punya tool apa pun yang menyinggung investasi. Konsekuensi saat ini: data `investment_accounts`/`investment_purchases`/`investment_sales` cuma ada di SQLite lokal desktop, TIDAK ter-sync ke cloud/multi-device, dan tidak bisa diakses/dikelola lewat asisten AI (beda dari transaksi, akun kas, dan utang piutang yang semuanya sudah bisa).

Fitur lintas-app: `apps/desktop` (PC, pemilik logic & UI, SUDAH selesai) → `apps/worker` (Cloudflare, BELUM ada tipe `investment` sama sekali) → `apps/mcp-server` (Vercel, jembatan ke Claude — BELUM ada tool investasi apa pun).

Peta gap awal (riset 2026-10-07): `AccountType` Worker cuma 2 nilai, `classifyAccountPair` Worker cuma 4 varian (desktop sudah 6, termasuk `cash-investment`/`investment-cash`), CHECK constraint `accounts.account_type` di D1 (`0001_initial.sql`) cuma `'cash'`/`'debt'`, tidak ada tabel D1 setara `investment_accounts`/`investment_purchases`/`investment_sales`, dan di sisi desktop sendiri `QueueableTable`/`DeletableTable` (`shared/cloud-sync/push-queue.ts`) belum memasukkan tabel-tabel itu sama sekali — secara struktural desktop belum BISA memanggil push untuk investment walau ingin.

## Tahap 0 — Keputusan scope (SELESAI, 2026-10-07)

Keputusan: **replikasi logic penuh**, pola sama `debts` — BUKAN cuma CRUD data mentah/mirror pasif. Alasan eksplisit dari user: Worker bukan backend khusus desktop, melainkan dipakai juga oleh `apps/mobile` (belum dibangun) dan `apps/mcp-server`/asisten AI — kalau Worker cuma terima snapshot yang sudah dihitung desktop, device/klien lain (mobile, MCP tool TULIS) tidak akan pernah bisa mencatat pembelian/penjualan investasi baru tanpa lewat desktop dulu, yang bertentangan dengan prinsip "Worker = satu-satunya penulis D1 production" yang sudah dipegang `debts`/`transactions`/dll.

Konsekuensi konkret: `apps/worker` butuh modul `investments/` yang menduplikasi logic inti desktop (`getAverageCostPerUnit`, `getRemainingUnit`, validasi oversell, snapshot average cost/Realized P/L saat settle) — BUKAN cuma skema tabel. Setiap revisi logic investasi di desktop ke depan (riwayat hari ini: 3 revisi besar dalam 1 sesi — model awal, 2 fix migrasi checksum, revisi arsitektur settlement) WAJIB di-port manual ke Worker juga, sama seperti `debts/service.ts` saat ini mengikuti `apply-debt-transaction.ts`. Ini pekerjaan tersendiri yang signifikan (Tahap 2 di bawah), bukan sekadar "tambah tabel".

**Sempat dipertimbangkan: apakah logic ini bisa ditulis sekali (reusable), bukan diduplikasi?** Ditolak secara sadar (2026-10-07). Pertimbangan: desktop (Tauri + `@tauri-apps/plugin-sql`, driver SQLite native) dan Worker (Cloudflare Workers runtime + D1, `prepare().bind().run()`) punya signature driver DB yang berbeda total — fungsi seperti `getAverageCostPerUnit(db, accountId)` tidak bisa dipanggil literal di kedua sisi tanpa lapisan abstraksi driver (interface generik `{ select, execute }` + 2 adapter). Monorepo ini juga belum punya `packages/*` shared sama sekali (`workspaces` di `package.json` root cuma `apps/*`) — bikin package baru + abstraksi driver + risiko abstraksi bocor (transaksi/locking SQLite vs D1 berbeda karakteristik) dinilai lebih mahal daripada duplikasi manual utk permukaan logic sekecil ini (~5 fungsi). Keputusan: **tetap duplikasi penuh**, pola persis `debts` yang sudah berjalan — disinkronkan manual tiap kali logic desktop berubah, bukan direkayasa reusable.

## Tahap 1 — Skema D1 (migrasi ditulis + diverifikasi di D1 LOKAL, 2026-10-07 — BELUM di-apply ke D1 remote/production)

File baru `apps/worker/schema/0002_account_type_investment.sql` (1 file gabungan, keputusan eksplisit): copy-and-rename `accounts`/`transactions`/`debts`/`debt_payments` (pola persis migrasi desktop `0035`, krn D1 tidak support `ALTER...CHECK` dan `accounts` direferensikan FK banyak tabel) utk tambah `'investment'` ke CHECK, DITAMBAH `CREATE TABLE` murni 3 tabel baru (`investment_accounts`/`investment_purchases`/`investment_sales`, tabel baru jadi tidak perlu copy-and-rename). Beda dari skema desktop: ketiga tabel baru ini DITAMBAH kolom `updated_at`/`deleted_at`/`sync_source` (LWW, pola sama 7 tabel yg sudah ada di `0001_initial.sql`) — desktop tidak punya kolom ini sama sekali (lihat catatan Tahap 3 di bawah, desktop perlu migrasi sendiri utk ini sebelum bisa push).

**Diverifikasi di D1 LOKAL** (`npx wrangler d1 execute financial-app --local --file=schema/0002_account_type_investment.sql`, Miniflare `.wrangler/state/v3/d1/`, yang ternyata sudah berisi data nyata hasil `wrangler dev` sebelumnya — 83 accounts/5549 transactions/15 debts/5 debt_payments): 48 command sukses, jumlah baris semua tabel lama TIDAK berubah (data aman), skema `accounts` terkonfirmasi `CHECK (account_type IN ('cash', 'debt', 'investment'))`, insert akun `account_type='investment'` berhasil, insert tipe tak dikenal (`'bogus'`) tetap ditolak CHECK constraint seperti seharusnya. Data uji coba dibersihkan setelahnya.

**BELUM di-apply ke `--remote` (production)** — keputusan eksplisit: ditunda sampai modul `investments/` (Tahap 2) juga siap, supaya skema dan kode logic berubah bersamaan, bukan skema menganggur duluan tanpa endpoint yang memakainya.

Skema final desktop (hasil akhir 7 migrasi, `0035`-`0041`) yang jadi referensi migrasi ini:

`accounts.account_type` CHECK bertambah jadi `'cash' | 'debt' | 'investment'` (migrasi `0035`, full copy-and-rename krn `accounts` direferensikan FK banyak tabel lain).

`investment_accounts` (1:1 dgn `accounts`, migrasi `0036`+`0037`):
```sql
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`investment_purchases` (riwayat pembelian per lot, migrasi `0036`+`0038`):
```sql
CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`investment_sales` (riwayat penjualan per lot, migrasi `0039`+`0040`+`0041`):
```sql
CREATE TABLE investment_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    average_cost_per_unit REAL,
    realized_pl REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Catatan penting utk desain migrasi Worker (BELUM diputuskan, baru pengamatan): ketiga tabel investment di desktop TIDAK punya kolom `updated_at`/`deleted_at`/`sync_source`/trigger LWW yang biasanya menyertai tabel yang disync (`accounts`/`transactions`/`debts`/`debt_payments` semua punya) — kalau mau disync, kolom2 itu kemungkinan perlu ditambahkan di sisi D1 (dan mungkin di desktop juga, supaya LWW jalan dua arah). Tidak ada kolom `source`/`source_ref` (provenance Retailku) karena fitur ini belum pernah disentuh Retailku sync — BUKAN berarti tertutup, `account-type-investment.md` sendiri mencatat ini sbg kemungkinan terbuka ("begitu tipe investment ada, transaksi Retailku jenis ini BISA dipetakan ke sini") yang belum dikerjakan. Ketiga tabel ini TIDAK direferensikan FK oleh tabel lain mana pun di desktop, beda dari `accounts`/`transactions` yang jadi FK banyak tabel — kemungkinan besar sama di D1, jadi migrasi Worker TIDAK perlu pola copy-and-rename serumit `accounts`.

## Tahap 2 — Worker: logic bisnis (SELESAI, 2026-10-07)

**Selesai**: `classify-account-pair.ts` — `AccountPairKind` tambah `cash-investment`/`investment-cash`, `classifyAccountPair` tambah 2 baris `if` (persis sama desktop). `debts/service.ts`: guard no-op di `applyDebtTransaction` (sebelumnya cuma `cash-cash`/`debt-debt`) diperluas mencakup `cash-investment`/`investment-cash` — supaya transfer melibatkan akun investment TIDAK diproses sebagai urusan debt (modul `investments/` terpisah yang akan jadi pemiliknya), komentar "satu-satunya variant tersisa" di cabang `debt-cash` diperbaiki supaya tidak lagi menyiratkan cuma ada 2 variant. `validateAccountPairSupported` TIDAK perlu diubah — otomatis ikut mengizinkan `cash-investment`/`investment-cash` lolos precheck begitu `classifyAccountPair` tidak lagi throw utk keduanya (sebelumnya transfer ke/dari akun investment akan ditolak 422 di titik ini). Diverifikasi: `tsc --noEmit` bersih. Tidak ada test otomatis di `apps/worker` sama sekali (beda dari desktop) — verifikasi manual lewat `wrangler dev`/`d1 execute` jadi satu-satunya jalur, lihat Tahap 2 lanjutan di bawah.

**Selesai — PEMBELIAN investasi (2026-10-07)**: Modul `investments/` baru dibuat (`service.ts`/`schema.ts`/`controller.ts`/`router.ts`, pola sama `debts/`) — replikasi PENUH `apply-investment-transaction.ts` desktop: `applyInvestmentTransaction` (PEMILIK logic, dipicu dari `transactions/service.ts` persis pola `applyDebtTransaction`), `applyInvestmentTransactionEdit`, `detachInvestmentPurchaseForDeletedTransaction` — BEDA dari desktop (yang hard-DELETE): ketiganya di Worker **soft-delete** (`deleted_at`) krn baris ini ikut sync. Ditambah jalur push upsert-by-id (`pushInvestmentAccountFromPc`, `pushInvestmentPurchaseFromPc`, `deletePushedInvestmentPurchase`) pola persis `pushDebtFromPc`/`deletePushedDebt`, via endpoint baru `POST /investments/accounts/push`, `POST /investments/purchases/push`, `DELETE /investments/purchases/push/:id` (didaftarkan di `index.ts`).

Wiring pemicu di `transactions/service.ts`: `applyInvestmentTransaction` dipanggil di `createTransactionRow`, `applyInvestmentTransactionEdit` di `updateTransactionRow` (keduanya dgn guard `syncSource !== "pc"` sama seperti debt — transaksi dari desktop sudah py jalur push sendiri), `detachInvestmentPurchaseForDeletedTransaction` di `deleteTransaction` TANPA guard syncSource (pola sama `detachDebtForDeletedTransaction`, krn cuma soal baris turunan sendiri, aman dipanggil siapa pun). `transactions/schema.ts`: `PushTransactionPayload`/`PatchTransactionPayload` ditambah field `unit`/`pricePerUnit`/`investmentStatus` (sebelumnya TIDAK ADA tempat mengirim nilai ini sama sekali — baru disadari saat menulis wiring, bukan dari awal).

**Bug ditemukan+diperbaiki saat verifikasi** (bukan dari rencana awal): `shared/account-types.ts` — `AccountType`/`ACCOUNT_TYPES` TERNYATA masih `"cash" | "debt"` (BELUM diupdate sejak migrasi skema Tahap 1), menyebabkan `POST /accounts` dgn `accountType: "investment"` ditolak `{"error":"Invalid payload"}` meskipun skema D1 sudah mendukungnya sejak Tahap 1. Ditemukan lewat test manual langsung (bukan terduga dari rencana), diperbaiki sekaligus dgn menambah `"investment"` ke `ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION` (item checklist yang memang sudah direncanakan). Juga ditemukan: `investments/service.ts` draf awal pakai `crypto.randomUUID()` (UUIDv4 acak) utk id baru, padahal SELURUH app (desktop + Worker) konsisten pakai `uuidv7()` (time-ordered, package `uuidv7`) — diperbaiki sebelum sempat jadi inkonsistensi id di DB.

**Diverifikasi end-to-end via `wrangler dev` + `d1 execute --local`** (bukan cuma `tsc`, lihat pola yang sama dgn `docs/rules/checking-dev-database.md` desktop): buat akun cash+investment, push `investment_accounts`, `POST /transactions` transfer cash→investment via token MCP → baris `investment_purchases` terbentuk otomatis dgn `unit`/`price_per_unit`/`status` benar dan `transaction_id` terhubung; via token **PC** → TERKONFIRMASI **TIDAK** memicu apa pun (guard bekerja); push `investment_purchases` langsung via endpoint push PC → berhasil upsert; `PATCH /transactions/:id` ubah unit → baris lama soft-deleted, baris baru dibuat (recreate, bukan update in-place, sesuai desain `applyInvestmentTransactionEdit`); `DELETE /transactions/:id` → baris `investment_purchases` terkait ikut soft-deleted. Semua data uji coba dibersihkan setelahnya. `tsc --noEmit` bersih.

**Selesai — PENJUALAN investasi (2026-10-07)**: Replikasi PENUH `apply-sell-investment-transaction.ts` desktop ke `investments/service.ts` — `getAverageCostPerUnit`/`getRemainingUnit` (di-export, query D1 identik rumus desktop TAPI ditambah filter `deleted_at IS NULL` krn Worker soft-delete sedangkan desktop tidak py kolom itu sama sekali), `InsufficientInvestmentUnitsError`, `applySellInvestmentTransaction` (dua cabang status sama persis desktop: `pending` HANYA insert baris `investment_sales` tanpa transaksi apa pun, `settled` insert leg penyesuaian P/L + baris `investment_sales` lengkap), `createAdjustmentTransaction` (helper internal), `settleInvestmentSale`, `applySellInvestmentTransactionEdit`, `deleteInvestmentSaleAndAdjustment` (BEDA desktop: soft-delete KEDUA baris — `investment_sales` dan transaksi penyesuaiannya — bukan hard DELETE), `detachInvestmentSaleForDeletedTransaction`, `deletePendingInvestmentSale`. Ditambah jalur push (`pushInvestmentSaleFromPc`, `deletePushedInvestmentSale`) dan 2 endpoint aksi UI non-push (`settleInvestmentSale` dipanggil dari `POST /investments/sales/:id/settle`, `deletePendingInvestmentSale` dari `DELETE /investments/sales/:id` — BEDA dari endpoint push, Worker SENDIRI yang insert/hapus datanya, bukan upsert baris yang desktop sudah buat).

Endpoint baru: `POST /investments/sales/push`, `DELETE /investments/sales/push/:id`, `POST /investments/sales/:id/settle`, `DELETE /investments/sales/:id` (`schema.ts`: `PushInvestmentSalePayload`, `SettleInvestmentSalePayload`).

Wiring pemicu arah jual di `transactions/service.ts`: `applySellInvestmentTransaction` dipanggil di `createTransactionRow`, `applySellInvestmentTransactionEdit` di `updateTransactionRow`, `detachInvestmentSaleForDeletedTransaction` di `deleteTransaction` (sejajar persis pemicu pembelian) — status SELALU dipaksa `"settled"` di kedua titik (form transaksi utama desktop cuma mendukung jual settled, jual `pending` HANYA lewat dialog "Jual Investasi" khusus yang tidak pernah lewat `transactions/service.ts` sama sekali). Precheck oversell baru (`validateInvestmentSaleUnits`, `getTransactionInvestmentSaleUnit` utk kompensasi unit lama di jalur edit) dipanggil SEBELUM insert/update baris `transactions` — pola PERSIS `validateDebtSettlementAmount`, supaya reject tidak meninggalkan baris transaksi yatim.

**Bug ditemukan+diperbaiki saat verifikasi** (TIDAK terduga dari rencana — baru ketahuan dari smoke test manual, bukan review kode): transfer leg jual tersimpan dengan `amount` SALAH — nominal jual penuh (mis. 7500 = 5 unit × 1500) alih-alih `averageCost × unit` (seharusnya 5000). Akar masalah: `createTransactionRow`/`updateTransactionRow` meng-INSERT/UPDATE `payload.amount` APA ADANYA (nilai yang dikirim client) SEBELUM memanggil `applySellInvestmentTransaction` — padahal fungsi itu TIDAK PERNAH mengoreksi amount transaksi yang sudah ter-insert (cuma insert baris `investment_sales` + leg kedua). Ternyata desktop (`use-create-transaction.ts`/`use-update-transaction.ts`) punya logic yang TIDAK ikut direplikasi di awal: mendeteksi arah jual SEBELUM insert, lalu meng-override `amount` jadi `averageCost × unit` SEBELUM baris `transactions` dibuat — field `amount` dari form dikunci read-only di desktop, murni preview, BUKAN sumber kebenaran. Fix: fungsi baru `resolveInvestmentSellAmount` (deteksi arah via `classifyAccountPair` + hitung `averageCost × unit`, `null` kalau bukan arah jual) dipanggil di `createTransactionRow`/`updateTransactionRow` SEBELUM insert/update, hasil dipakai menggantikan `payload.amount` kalau non-null. Ditemukan & diperbaiki SEBELUM sempat di-deploy ke manapun (murni di D1 lokal).

**Diverifikasi end-to-end via `wrangler dev` + `d1 execute --local`** (skenario lengkap, semua lulus setelah fix amount di atas): beli 10 unit settled; jual 5 unit settled dgn untung (avg cost 1000, jual 1500 → transfer amount 5000 ✓, realized_pl 2500 ✓, adjustment leg income 2500 ✓); **oversell ditolak 422 SEBELUM insert transaksi** (jual 15 padahal sisa 10, transaksi tidak tersimpan sama sekali); jual **pending** via push langsung (TANPA transaksi apa pun, sesuai desain); **settle** baris pending (average cost & realized_pl dihitung SAAT settle, kedua FK terisi); **edit** transaksi jual settled (amount di-recreate benar dari unit/harga baru, baris lama soft-deleted, baris baru realized_pl benar); **delete** baris pending (soft-delete, sisa unit kembali bertambah). Catatan proses: endpoint push TIDAK re-validasi oversell (upsert-by-id murni, trust desktop sbg sumber kebenaran datanya sendiri — konsisten dgn `pushDebtFromPc` yg juga tidak re-validasi FIFO, BUKAN bug). `tsc --noEmit` bersih. Semua data uji coba dibersihkan setelahnya (termasuk 1 baris orphan `account_id=NULL` hasil `ON DELETE SET NULL` dari pembersihan test sebelumnya — ditemukan & dibersihkan, murni housekeeping test, bukan bug produksi).

## Tahap 3 — Desktop: migrasi kolom cloud-sync + wiring push (SELESAI, 2026-10-07)

**Migrasi `0042_investment_cloud_sync_columns.sql`**: tambah `deleted_at`/`sync_source` ke `investment_accounts`, `updated_at`/`deleted_at`/`sync_source` ke `investment_purchases`/`investment_sales` (pola persis migrasi `0028` 7 tabel non-investment), plus trigger auto-refresh `updated_at` ketiganya. `investment_accounts.updated_at` TIDAK ditambah ulang — sudah ada sejak migrasi `0037` utk fitur staleness nilai pasar (semantiknya kebetulan cocok dipakai jg sbg LWW). Didaftarkan di `migrations.rs` versi 42, 8 test Rust lulus (termasuk test baru yang mendokumentasikan bug lama trigger `WHEN NEW.x = OLD.x` tidak terpicu kalau keduanya NULL — berlaku sejak migrasi `0028` utk SEMUA tabel sync-able, bukan regresi baru, sengaja TIDAK diperbaiki krn di luar scope).

**Wiring push**: `push-queue.ts` (`QueueableTable`) dan `worker-client.ts` (`DeleteCloudPayload`, 3 payload type + 3 fungsi `pushInvestmentAccount`/`pushInvestmentPurchase`/`pushInvestmentSale`, `DELETE_PATH`) diperluas utk 3 tabel baru. `push-row.ts` ditambah 3 case baca-row-terbaru-lalu-format-payload (pola sama 7 tabel lain).

Lalu di-petakan (via subagent riset) SEMUA titik mutasi aktual yang menyentuh ketiga tabel — ditemukan **10 hook** yang sebelumnya cuma push `transactions`/`debts` tapi TIDAK push baris investment itu sendiri (beberapa bahkan masih punya komentar basi "belum termasuk tabel yang disync cloud", ditulis sebelum endpoint Worker ada). Semua 10 diperbaiki:

- `investment_accounts`: `use-create-account.ts`, `use-update-account.ts` (push setelah push `accounts`), `use-update-market-value.ts` (push baru ditambah, sebelumnya tidak ada wiring cloud-sync apa pun di file ini). Tidak perlu `pushDeleteOnWrite` sendiri — baris ini cuma hilang lewat cascade `DELETE /accounts`, sudah ditangani `use-delete-account.ts`.
- `investment_purchases`: `use-create-investment-purchase.ts`, `use-update-investment-purchase.ts` (push langsung). `use-create-transaction.ts`/`use-update-transaction.ts` (jalur beli form transaksi utama) — tangkap return value `applyInvestmentTransaction`/`Edit` yang sebelumnya diabaikan, push baris baru + `pushDeleteOnWrite` utk id lama hasil RECREATE (field berbahaya berubah). `use-delete-transaction.ts` — `pushDeleteOnWrite` SEBELUM hard-delete, pakai hasil `detachInvestmentPurchaseForDeletedTransaction`.
- `investment_sales`: `use-create-investment-sale.ts`, `use-settle-investment-sale.ts` (push langsung, komentar basi dihapus). `use-delete-pending-investment-sale.ts` — `pushDeleteOnWrite` sebelum hard-delete baris pending. `use-create-transaction.ts`/`use-update-transaction.ts` (jalur jual) — sejajar pola purchase. `use-delete-transaction.ts` — paling kompleks: `pushDeleteOnWrite` utk baris `investment_sales` **dan** transaksi adjustment Realized P/L yang ikut terhapus (`detachInvestmentSaleForDeletedTransaction` mengembalikan `adjustmentTransactionId`) — kalau tidak di-push-delete, baris itu jadi yatim di cloud.

Diverifikasi: `tsc --noEmit` bersih setelah seluruh wiring. **Belum** diverifikasi end-to-end nyata (push betul-betul sampai ke Worker lokal lalu dicek via `d1 execute`) — itu scope Tahap 5.

## Checklist tahapan
- [x] **Tahap 3** — selesai, lihat bagian "Tahap 3" di atas.
- [ ] **Tahap 4** — MCP server: tool baru utk investasi (BELUM diputuskan tool apa saja — kandidat: lihat `get_investment_summary` yang sudah lama jadi item terbuka di `account-type-investment.md`).
- [ ] **Tahap 5** — Verifikasi end-to-end (dogfooding nyata, pola sama Tahap 7 `cloud-sync-mcp.md` — bukan skenario test formal).

## Catatan

- **Belum ada urgensi/deadline** — proyek ini portofolio-only, fitur investasi desktop-only SUDAH sepenuhnya fungsional utk pemakaian sehari-hari single-device. Dokumen ini murni menangkap peta gap yang sudah diriset supaya tidak hilang, BUKAN komitmen kapan dikerjakan.
- Detail riset + implementasi lengkap (file+baris, keputusan desain, bug yang ditemukan) masih menyatu di dokumen index ini (bukan dipecah ke `apps/worker/docs/todos/plan/` mengikuti pola `cloud-sync-mcp.md`) — pertimbangkan dipecah begitu Tahap 3 (desktop) mulai dikerjakan, supaya detail per-app tidak terus menumpuk di satu file index.
- Sisi Worker **belum di-deploy ke `--remote`/production sama sekali** — migrasi skema (Tahap 1) dan seluruh kode modul `investments/` (Tahap 2) baru ada/teruji di D1 LOKAL. Deploy ke production adalah langkah terpisah yang perlu dikonfirmasi eksplisit sebelum dijalankan (`wrangler deploy` + `wrangler d1 execute --remote`), ditunda sampai minimal Tahap 3 (desktop bisa push) juga siap diuji end-to-end.

# Sync Tipe Akun Investasi ke Cloud — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (investment ikut sync cloud, sama seperti transactions/accounts/debts). Lihat [`../README.md`](../README.md) utk penjelasan umum struktur `docs/todos/{plan,done}/` di root repo.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan desain, riset, dan progress implementasi ada di dokumen masing-masing app — JANGAN duplikasi isi ke sini, cukup pointer.

## Status & TODO saat ini (ringkas)

Belum ada yang dikerjakan — dokumen ini baru menangkap peta gap hasil riset 2026-10-07. Penjelasan lengkap tiap poin ada di bagian "Latar belakang" dan "Checklist tahapan" di bawah.

- [x] Tipe akun `investment` selesai diimplementasikan penuh di `apps/desktop` (termasuk penjualan/penarikan sebagian), sudah di-smoke-test manual — lihat [`apps/desktop/docs/todos/plan/account-type-investment.md`](../../../apps/desktop/docs/todos/plan/account-type-investment.md).
- [x] Riset peta gap Worker vs desktop — selesai (2026-10-07), lihat ringkasan di bagian "Latar belakang" di bawah.
- [x] Tahap 0 — Keputusan desain scope sync: **replikasi logic penuh** (bukan CRUD data mentah) — lihat bagian "Tahap 0" di bawah.
- [x] Tahap 1 — Migrasi D1 (`schema/0002_account_type_investment.sql`) ditulis + diverifikasi di D1 LOKAL (2026-10-07), lihat bagian "Tahap 1" di bawah. BELUM di-apply ke `--remote`/production — ditunda sampai Tahap 2 (modul `investments/`) siap.
- [~] Tahap 2 — `classifyAccountPair` + guard no-op di `debts/service.ts` SELESAI (2026-10-07). Modul `investments/` (logic beli+jual) BELUM — pekerjaan utama tersisa, lihat bagian "Tahap 2" di bawah.
- [ ] Tahap 3 — Desktop: perluas whitelist sync (`QueueableTable`/`DeletableTable`) + fungsi push investment — belum dikerjakan.
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

## Tahap 2 — Worker: logic bisnis (SEDANG BERJALAN, 2026-10-07)

**Selesai**: `classify-account-pair.ts` — `AccountPairKind` tambah `cash-investment`/`investment-cash`, `classifyAccountPair` tambah 2 baris `if` (persis sama desktop). `debts/service.ts`: guard no-op di `applyDebtTransaction` (sebelumnya cuma `cash-cash`/`debt-debt`) diperluas mencakup `cash-investment`/`investment-cash` — supaya transfer melibatkan akun investment TIDAK diproses sebagai urusan debt (modul `investments/` terpisah yang akan jadi pemiliknya), komentar "satu-satunya variant tersisa" di cabang `debt-cash` diperbaiki supaya tidak lagi menyiratkan cuma ada 2 variant. `validateAccountPairSupported` TIDAK perlu diubah — otomatis ikut mengizinkan `cash-investment`/`investment-cash` lolos precheck begitu `classifyAccountPair` tidak lagi throw utk keduanya (sebelumnya transfer ke/dari akun investment akan ditolak 422 di titik ini). Diverifikasi: `tsc --noEmit` bersih. Tidak ada test otomatis di `apps/worker` sama sekali (beda dari desktop) — verifikasi manual lewat `wrangler dev`/`d1 execute` jadi satu-satunya jalur, lihat Tahap 2 lanjutan di bawah.

**BELUM dikerjakan** (sisa Tahap 2, pekerjaan utama & terbesar di seluruh fitur ini):
- Modul `investments/` baru (router/controller/service/schema, pola sama `debts/`) — replikasi PENUH logic `apply-investment-transaction.ts` (beli) DAN `apply-sell-investment-transaction.ts` (jual, jauh lebih kompleks: average cost, Realized P/L snapshot, validasi oversell, `settleInvestmentSale`, `deletePendingInvestmentSale`) dari desktop.
- Keputusan "pemilik vs pemicu" (`apps/worker/docs/rules/module-structure.md`) — kemungkinan besar modul `investments/` jadi PEMILIK, dipicu dari `transactions/service.ts` SETELAH insert/update baris `transactions` berhasil, pola persis `applyDebtTransaction`/`applyDebtEditAction`.
- `transactions/service.ts`: wiring pemicu ke modul `investments/` baru (di `createTransactionRow`/`updateTransactionRow`, titik yang sama tempat `applyDebtTransaction`/`applyDebtEditAction` dipanggil sekarang).
- `accounts/service.ts`: tambah `"investment"` ke `ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION` (`shared/account-types.ts`) — saldo investment derived dari tabel turunan (`investment_purchases`/`investment_sales`), bukan murni transfer, komentar di file itu sudah mengantisipasi ini.
- Endpoint publik setara `/debts/push` dkk (`POST /investments/accounts`, `/investments/purchases`, `/investments/sales`, atau struktur serupa — BELUM diputuskan bentuk API-nya) utk jalur push dari desktop (Tahap 3).

## Checklist tahapan
- [ ] **Tahap 3** — Desktop: perluas `QueueableTable`/`DeletableTable`/`SyncResponse` (`shared/cloud-sync/push-queue.ts`, `worker-client.ts`) utk 3 tabel investment baru, tambah `pushInvestmentAccount`/`pushInvestmentPurchase`/`pushInvestmentSale` + wiring `pushOnWrite` di hook-hook yang relevan (pola sama `pushDebt`/`pushDebtPayment`).
- [ ] **Tahap 4** — MCP server: tool baru utk investasi (BELUM diputuskan tool apa saja — kandidat: lihat `get_investment_summary` yang sudah lama jadi item terbuka di `account-type-investment.md`).
- [ ] **Tahap 5** — Verifikasi end-to-end (dogfooding nyata, pola sama Tahap 7 `cloud-sync-mcp.md` — bukan skenario test formal).

## Catatan

- **Belum ada urgensi/deadline** — proyek ini portofolio-only, fitur investasi desktop-only SUDAH sepenuhnya fungsional utk pemakaian sehari-hari single-device. Dokumen ini murni menangkap peta gap yang sudah diriset supaya tidak hilang, BUKAN komitmen kapan dikerjakan.
- Detail riset lengkap (file+baris per titik gap) ada di riwayat percakapan sesi 2026-10-07 — belum dipindah ke dokumen detail `apps/worker/docs/todos/plan/` karena Tahap 1 (eksekusi) belum dimulai. Begitu ada keputusan utk mulai kerja, pecah index ini jadi detail per-app mengikuti pola `cloud-sync-mcp.md`.

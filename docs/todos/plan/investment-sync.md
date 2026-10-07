# Sync Tipe Akun Investasi ke Cloud — Index Navigasi

> Index navigasi utk SATU fitur lintas-app spesifik (investment ikut sync cloud, sama seperti transactions/accounts/debts). Lihat [`../README.md`](../README.md) utk penjelasan umum struktur `docs/todos/{plan,done}/` di root repo.

Index ini HANYA navigasi + checklist ringkas. Detail keputusan desain, riset, dan progress implementasi ada di dokumen masing-masing app — JANGAN duplikasi isi ke sini, cukup pointer.

## Status & TODO saat ini (ringkas)

Belum ada yang dikerjakan — dokumen ini baru menangkap peta gap hasil riset 2026-10-07. Penjelasan lengkap tiap poin ada di bagian "Latar belakang" dan "Checklist tahapan" di bawah.

- [x] Tipe akun `investment` selesai diimplementasikan penuh di `apps/desktop` (termasuk penjualan/penarikan sebagian), sudah di-smoke-test manual — lihat [`apps/desktop/docs/todos/plan/account-type-investment.md`](../../../apps/desktop/docs/todos/plan/account-type-investment.md).
- [x] Riset peta gap Worker vs desktop — selesai (2026-10-07), lihat ringkasan di bagian "Latar belakang" di bawah.
- [ ] Tahap 0 — Keputusan desain scope sync (replikasi logic penuh vs CRUD data mentah) — BELUM diputuskan.
- [ ] Tahap 1 — Skema D1 (migrasi `account_type` + 3 tabel baru) — belum dikerjakan.
- [ ] Tahap 2 — Worker: `classifyAccountPair` + modul `investments/` + guard `correctAccountBalance` — belum dikerjakan.
- [ ] Tahap 3 — Desktop: perluas whitelist sync (`QueueableTable`/`DeletableTable`) + fungsi push investment — belum dikerjakan.
- [ ] Tahap 4 — MCP server: tool investasi baru — belum dikerjakan, belum diputuskan tool apa saja.
- [ ] Tahap 5 — Verifikasi end-to-end (dogfooding nyata) — belum dikerjakan.

## Latar belakang

Tipe akun `investment` sudah selesai diimplementasikan penuh di `apps/desktop` (lihat [`apps/desktop/docs/todos/plan/account-type-investment.md`](../../../apps/desktop/docs/todos/plan/account-type-investment.md)) — termasuk pembelian, penjualan/penarikan sebagian, average cost, Realized/Unrealized P/L, sudah di-smoke-test manual (2026-10-07). Tapi ini **desktop-only**: `apps/worker` (Cloudflare, satu-satunya penulis D1 production) sama sekali belum punya tipe akun `investment` — `AccountType` di sana masih `"cash" | "debt"` — dan `apps/mcp-server` juga belum punya tool apa pun yang menyinggung investasi. Konsekuensi saat ini: data `investment_accounts`/`investment_purchases`/`investment_sales` cuma ada di SQLite lokal desktop, TIDAK ter-sync ke cloud/multi-device, dan tidak bisa diakses/dikelola lewat asisten AI (beda dari transaksi, akun kas, dan utang piutang yang semuanya sudah bisa).

Fitur lintas-app: `apps/desktop` (PC, pemilik logic & UI, SUDAH selesai) → `apps/worker` (Cloudflare, BELUM ada tipe `investment` sama sekali) → `apps/mcp-server` (Vercel, jembatan ke Claude — BELUM ada tool investasi apa pun).

Peta gap awal (riset 2026-10-07): `AccountType` Worker cuma 2 nilai, `classifyAccountPair` Worker cuma 4 varian (desktop sudah 6, termasuk `cash-investment`/`investment-cash`), CHECK constraint `accounts.account_type` di D1 (`0001_initial.sql`) cuma `'cash'`/`'debt'`, tidak ada tabel D1 setara `investment_accounts`/`investment_purchases`/`investment_sales`, dan di sisi desktop sendiri `QueueableTable`/`DeletableTable` (`shared/cloud-sync/push-queue.ts`) belum memasukkan tabel-tabel itu sama sekali — secara struktural desktop belum BISA memanggil push untuk investment walau ingin.

## Checklist tahapan

- [ ] **Tahap 0** — Keputusan desain: apakah sync investment di-scope penuh (replikasi logic `applySellInvestmentTransaction`/average cost/Realized P/L ke Worker, pola sama `debts`) atau cuma replikasi data mentah (CRUD tanpa logic bisnis turunan di sisi Worker)? Keputusan ini menentukan besar kerja Tahap 2 & 4 di bawah — BELUM diputuskan, belum ada riset lanjutan.
- [ ] **Tahap 1** — Skema D1: migrasi baru utk `accounts.account_type` (copy-and-rename, D1 tidak support `ALTER...CHECK`) + 3 tabel baru (`investment_accounts`, `investment_purchases`, `investment_sales` dengan `adjustment_transaction_id`, lihat skema desktop migrasi 0035-0041 sbg referensi kolom).
- [ ] **Tahap 2** — Worker: `classifyAccountPair` tambah 2 varian (`cash-investment`/`investment-cash`), modul `investments/` baru (router/controller/service/schema, pola sama `debts/`), keputusan "pemilik vs pemicu" (kemungkinan dipicu dari `transactions/service.ts` sama seperti debt). `accounts/service.ts`: tambah `"investment"` ke `ACCOUNT_TYPES_RESTRICTED_FROM_DIRECT_TRANSACTION` (saldo investment derived dari tabel turunan, bukan murni transfer — komentar di `shared/account-types.ts` sudah mengantisipasi ini).
- [ ] **Tahap 3** — Desktop: perluas `QueueableTable`/`DeletableTable`/`SyncResponse` (`shared/cloud-sync/push-queue.ts`, `worker-client.ts`) utk 3 tabel investment baru, tambah `pushInvestmentAccount`/`pushInvestmentPurchase`/`pushInvestmentSale` + wiring `pushOnWrite` di hook-hook yang relevan (pola sama `pushDebt`/`pushDebtPayment`).
- [ ] **Tahap 4** — MCP server: tool baru utk investasi (BELUM diputuskan tool apa saja — kandidat: lihat `get_investment_summary` yang sudah lama jadi item terbuka di `account-type-investment.md`).
- [ ] **Tahap 5** — Verifikasi end-to-end (dogfooding nyata, pola sama Tahap 7 `cloud-sync-mcp.md` — bukan skenario test formal).

## Catatan

- **Belum ada urgensi/deadline** — proyek ini portofolio-only, fitur investasi desktop-only SUDAH sepenuhnya fungsional utk pemakaian sehari-hari single-device. Dokumen ini murni menangkap peta gap yang sudah diriset supaya tidak hilang, BUKAN komitmen kapan dikerjakan.
- Detail riset lengkap (file+baris per titik gap) ada di riwayat percakapan sesi 2026-10-07 — belum dipindah ke dokumen detail `apps/worker/docs/todos/plan/` karena Tahap 0 (keputusan scope) belum diambil. Begitu ada keputusan utk mulai kerja, pecah index ini jadi detail per-app mengikuti pola `cloud-sync-mcp.md`.

# Periode Kategori — MCP Server

> Detail implementasi sisi `apps/mcp-server` utk fitur lintas-app
> "Periode Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Baru tahap rencana — belum ada kode ditulis. Lihat bagian "Rencana
pendekatan" di bawah utk detail.

- [ ] `sync-snapshot.ts` — tipe `CategoryPeriod` ditambah ke
  `SyncSnapshot` (field: `id`, `categoryId`, `name`, `startDate`,
  `endDate`).
- [ ] `sync-snapshot.ts` — fungsi baru `getCategoryPeriodSummary`
  (satu periode: total masuk/keluar/selisih + daftar transaksi,
  dihitung dari `transactions` yg SUDAH ada di snapshot yg sama,
  filter `categoryId` + `date BETWEEN startDate AND endDate`) dan
  `listCategoryPeriods` (opsional filter by `categoryId`).
- [ ] 4 tool baru di `mcp-tools/category-periods/`:
  `list_category_periods`, `create_category_period`,
  `update_category_period`, `delete_category_period` — pola
  `mcp-tools/categories/`.
- [ ] 1 tool baca ringkasan: `get_category_period_summary` (input
  `periodId` ATAU `categoryId`+nama, TBD saat implementasi —
  tergantung apakah user/asisten lebih sering tahu id atau nama).
- [ ] Didaftarkan di `mcp-tools/index.ts`.
- [ ] Verifikasi via `wrangler dev` (Worker lokal) + `next dev` (MCP
  lokal) + `curl` JSON-RPC, pola `investment-sync.md` Tahap 5 Grup B.

## Rencana pendekatan

### Baca vs tulis

Beda dari `/category-periods/:id/summary` endpoint Worker (lihat
`apps/worker/docs/todos/plan/category-period.md`) yang disediakan
tapi TIDAK dipakai jalur ini — MCP membaca dari snapshot `/sync`
(`fetchFullSnapshot`, satu kali fetch berisi SEMUA tabel termasuk
`transactions` & `categoryPeriods`), lalu hitung ringkasan sendiri di
`sync-snapshot.ts`, pola PERSIS `summarizeExpenseByCategory`/
`getInvestmentHolding` yg sudah ada — BUKAN request HTTP terpisah per
periode. Alasan: snapshot sudah berisi semua data yg dibutuhkan,
round-trip tambahan cuma menduplikasi logic agregasi di 2 tempat
(Worker endpoint + MCP) utk hasil yang sama.

Tulis (create/update/delete periode) lewat `workerFetch` ke endpoint
push Worker (`POST /category-periods/push`, dst) — pola `create-category.ts`.

### Tool yang dibuat

Mengikuti pola `categories/` (CRUD penuh, resource sederhana tanpa
state machine) BUKAN pola `investments/` (yang py tool aksi khusus
settle/write-off krn ada status pending/settled — Periode Kategori
TIDAK punya status seperti itu):

- `list_category_periods` — opsional filter `categoryId`, baca dari
  snapshot.
- `get_category_period_summary` — input `periodId`, return nama,
  rentang tanggal, total masuk/keluar/selisih, daftar transaksi
  (dgn `transactionId` tiap baris spy `update_transaction`/
  `delete_transaction` yg sudah ada bisa dipakai langsung, pola sama
  `get_investment_detail`).
- `create_category_period` — input `categoryId`, `name`, `startDate`,
  `endDate`. Validasi bentuk (field ada, tanggal valid) di level MCP
  sebelum kirim ke Worker, pola `create-category.ts`.
- `update_category_period` — input `id` + field yg mau diubah.
- `delete_category_period` — input `id`, `confirm: true` wajib (pola
  `write_off_debt`/`delete_pending_investment_sale` — ini
  destructive, walau cuma soal metadata rentang tanggal, bukan uang).

### Yang SENGAJA tidak dibuat

- Tidak ada tool "list periode lintas semua kategori sekaligus dgn
  ringkasan penuh" (N+1 query mahal kalau periode banyak) — kalau
  user minta "semua ringkasan panen tahun ini", asisten panggil
  `list_category_periods` dulu lalu `get_category_period_summary`
  per id yg relevan. Bisa direvisi kalau ternyata pola pakai nyata
  butuh agregasi lintas periode.

## Catatan

- `apps/mcp-server` belum punya folder `docs/todos/` sebelum dokumen
  ini — dibuat baru, bukan pola existing yg diperluas.
- Belum ada urgensi/deadline — proyek portofolio-only.
- Urutan kerja: ini tahap TERAKHIR (butuh Worker siap dulu, snapshot
  `/sync` dan endpoint push harus ada sebelum tool MCP bisa jalan) —
  lihat index root.

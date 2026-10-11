# Periode Kategori — MCP Server

> Detail implementasi sisi `apps/mcp-server` utk fitur lintas-app
> "Periode Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Baru tahap rencana — belum ada kode ditulis sama sekali (dikonfirmasi
2026-10-11: tidak ada folder `mcp-tools/category-periods/`). Lihat
bagian "Rencana pendekatan" di bawah utk detail.

**REVISI (2026-10-11)**: dokumen ini awalnya ditulis SEBELUM revisi
skema many-to-many di sisi desktop (migrasi `0048` — lihat
`apps/desktop/docs/todos/plan/category-period.md`). Seluruh isi di
bawah SUDAH disesuaikan ke skema baru (`categoryIds: string[]`,
bukan `categoryId` tunggal) — lihat "Revisi: many-to-many kategori"
di bawah utk detail apa saja yg berubah. **5 tool (bukan 4) yg
direncanakan SUDAH mewakili semua kemampuan CRUD + ringkasan yg ada
di desktop** (create/edit/delete/list+filter+sort/ringkasan) — bukan
kurang tool, kemarin cuma skemanya yg basi.

- [ ] `sync-snapshot.ts` — tipe `CategoryPeriod` ditambah ke
  `SyncSnapshot` (field: `id`, `categoryIds` (array, BUKAN
  `categoryId` tunggal), `name`, `startDate`, `endDate`).
- [ ] `sync-snapshot.ts` — fungsi baru `getCategoryPeriodSummary`
  (satu periode: total masuk/keluar/selisih + daftar transaksi,
  dihitung dari `transactions` yg SUDAH ada di snapshot yg sama,
  filter `categoryId IN categoryIds` + `date BETWEEN startDate AND
  endDate`) dan `listCategoryPeriods` (opsional filter by nama DAN/
  ATAU `categoryId` tunggal — match kalau `categoryId` ada di
  `categoryIds` periode itu, pola sama filter kategori di desktop).
- [ ] 4 tool CRUD baru di `mcp-tools/category-periods/`:
  `list_category_periods`, `create_category_period`,
  `update_category_period`, `delete_category_period` — pola
  `mcp-tools/categories/`.
- [ ] 1 tool baca ringkasan: `get_category_period_summary` (input
  `periodId`).
- [ ] Didaftarkan di `mcp-tools/index.ts`.
- [ ] Verifikasi via `wrangler dev` (Worker lokal) + `next dev` (MCP
  lokal) + `curl` JSON-RPC, pola `investment-sync.md` Tahap 5 Grup B.

## Rencana pendekatan

### Revisi: many-to-many kategori (2026-10-11)

Skema desktop direvisi (migrasi `0048`, lihat
`apps/desktop/docs/todos/plan/category-period.md` bagian "Revisi:
many-to-many kategori") — satu Periode TIDAK LAGI terikat ke satu
`category_id`, melainkan ke SEKUMPULAN kategori lewat tabel pivot
`category_period_categories` (lintas tipe income/expense sekaligus,
mis. "Panen" mencakup kategori biaya pupuk DAN hasil jual panen
sekaligus). Dokumen ini ditulis sebelum revisi itu terjadi dan
SELURUH isinya sudah disesuaikan menyusul:

- Tipe `CategoryPeriod` di snapshot: field `categoryId` (string)
  jadi `categoryIds` (`string[]`).
- `getCategoryPeriodSummary`/query ringkasan: filter `category_id IN
  categoryIds` (bukan `category_id = categoryId`).
- `create_category_period`/`update_category_period`: input
  `categoryId` jadi `categoryIds` (array, minimal 1 elemen — sama
  validasi dgn `categoryPeriodSchema` di desktop,
  `z.array(z.string()).min(1)`).
- `list_category_periods`: filter opsional `categoryId` TUNGGAL
  tetap masuk akal sbg parameter filter (cari periode yg MENCAKUP
  kategori tsb), tapi secara internal jadi `categoryId ∈
  period.categoryIds`, bukan `categoryId === period.categoryId`.

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

- `list_category_periods` — opsional filter nama (ilike) DAN/ATAU
  `categoryId` tunggal (match kalau ada di `period.categoryIds`),
  baca dari snapshot. BELUM termasuk filter status berlangsung/
  selesai spt di desktop (`list/period-filter.tsx`) — TBD saat
  implementasi, bisa dihitung on-the-fly dari `startDate`/`endDate`
  vs tanggal hari ini, sama prinsip `is_ongoing` di desktop.
- `get_category_period_summary` — input `periodId`, return nama,
  rentang tanggal, total masuk/keluar/selisih, daftar transaksi
  (dgn `transactionId` tiap baris spy `update_transaction`/
  `delete_transaction` yg sudah ada bisa dipakai langsung, pola sama
  `get_investment_detail`). Filter transaksi: `category_id IN
  categoryIds` (array, BUKAN `categoryId` tunggal — lihat revisi di
  atas) + `date BETWEEN startDate AND endDate`, match persis
  `useCategoryPeriodSummary`/`useCategoryPeriodTransactions` di
  desktop (`features/reports/content/category-period-summary/`).
- `create_category_period` — input `categoryIds` (array, min 1),
  `name`, `startDate`, `endDate`. Validasi bentuk (field ada, tanggal
  valid, `categoryIds` tidak kosong) di level MCP sebelum kirim ke
  Worker, pola `create-category.ts`.
- `update_category_period` — input `id` + field yg mau diubah
  (termasuk `categoryIds` kalau mau ganti kategori terkait — pola
  desktop `useUpdateCategoryPeriod`: ganti seluruh baris pivot, bukan
  diff, krn tidak ada tracking historis pivot yg perlu dipertahankan).
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

# Periode Kategori — Worker

> Detail implementasi sisi `apps/worker` utk fitur lintas-app
> "Periode Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Migrasi D1 SUDAH diterapkan ke lokal (2026-10-11). Modul/endpoint/
sync BELUM — scope sesi berikutnya. Lihat bagian "Rencana
pendekatan" di bawah utk detail.

**REVISI (2026-10-11)**: dokumen ini awalnya ditulis SEBELUM revisi
skema many-to-many di sisi desktop (migrasi `0048` — lihat
`apps/desktop/docs/todos/done/category-period.md`). Seluruh isi di
bawah SUDAH disesuaikan: skema D1 yg awalnya 1 tabel (`category_id`
tunggal) jadi 2 tabel (`category_periods` + tabel pivot
`category_period_categories`, pola PERSIS 3 junction table label di
`0005_labels.sql`) — lihat "Revisi: many-to-many kategori" di bawah.

- [x] Migrasi D1 `schema/0006_category_periods.sql` (2026-10-11) — 2
  `CREATE TABLE` murni (tabel baru, tidak direferensikan FK tabel lain
  → tidak perlu pola copy-and-rename seperti migrasi `accounts`).
  Diterapkan ke D1 **lokal** (`wrangler d1 execute financial-app
  --local --file=schema/0006_category_periods.sql`), diverifikasi via
  `SELECT sql FROM sqlite_master WHERE type='table' AND name IN
  (...)` — struktur kedua tabel sesuai persis rencana. **BELUM
  diterapkan ke `--remote`/production** (lihat item deploy di bawah).
- [x] Modul `category-periods/` (`schema.ts`/`service.ts`/
  `controller.ts`/`router.ts`, pola `categories/`) (2026-10-11) — CRUD
  upsert-by-id dgn LWW (`shared/lww.ts`) utk `category_periods`, PLUS
  replace-all baris pivot tiap upsert (pola desktop
  `useUpdateCategoryPeriod`: DELETE semua baris pivot lama + INSERT
  ulang, bukan diff) + soft-delete. Diverifikasi lokal via
  `wrangler dev` (insert, update dgn replace-all pivot, LWW stale
  ditolak, soft-delete, delete ganda 404, tanpa token 401).
- [x] Query ringkasan on-the-fly (2026-10-11) (total masuk/keluar +
  daftar transaksi) berdasar `category_id IN (SELECT category_id FROM
  category_period_categories WHERE period_id = ?)` + `start_date`/
  `end_date` — SUM/SELECT langsung ke `transactions`, tidak ada tabel
  agregat. Diverifikasi lokal, match query desktop.
- [x] Endpoint push (`POST /category-periods/push`,
  `DELETE /category-periods/push/:id`) (2026-10-11) utk jalur sync PC,
  pola persis `pushDebtFromPc`/`deletePushedDebt`. Diverifikasi lokal.
- [x] Didaftarkan di `src/index.ts` (`.route("/category-periods", ...)`)
  (2026-10-11).
- [x] Perluasan `/sync` snapshot (`sync/service.ts`) (2026-10-11) —
  tambah `categoryPeriods` (dgn `categoryIds: string[]` sudah di-JOIN
  via `LEFT JOIN` + `GROUP_CONCAT`, BUKAN baris pivot mentah terpisah)
  ke `SyncResponse`/`getSyncSnapshot`, pola sama tabel lain yang sudah
  ada. `LEFT JOIN` (bukan INNER spt query list desktop) supaya periode
  TANPA kategori pun tetap muncul (`categoryIds: []`). Filter `since`
  di kolom induk (`category_periods.updated_at`) saja. Diverifikasi
  lokal via `wrangler dev`: periode dgn kategori, periode tanpa
  kategori, dan filter `since`.
- [x] Verifikasi lokal via `wrangler dev` (2026-10-11) — modul/endpoint
  SUDAH diverifikasi per-item di atas, migrasi D1 diverifikasi lokal
  duluan di poin migrasi. Semua bersih sebelum deploy.
- [ ] Deploy ke `--remote`/production — desktop SUDAH wired push
  (2026-10-11, lihat `apps/desktop/docs/todos/done/category-period.md`),
  tidak ada blocker teknis lagi, tinggal dieksekusi. Migrasi D1 JUGA
  perlu diterapkan ulang ke `--remote` saat itu (saat ini cuma lokal).

## Rencana pendekatan

### Revisi: many-to-many kategori (2026-10-11)

Skema desktop direvisi (migrasi `0048`, lihat
`apps/desktop/docs/todos/done/category-period.md` bagian "Revisi:
many-to-many kategori") — satu Periode TIDAK LAGI terikat ke satu
`category_id`, melainkan ke SEKUMPULAN kategori lewat tabel pivot
`category_period_categories` (lintas tipe income/expense sekaligus).
Dokumen ini ditulis sebelum revisi itu terjadi; skema D1 di bawah
SUDAH disesuaikan jadi 2 tabel, bukan 1.

### Skema D1

`category_periods` TANPA `category_id` + tabel pivot baru
`category_period_categories` — keduanya `CREATE TABLE` murni (tidak
perlu copy-and-rename krn SEMUA tabel di sini baru, tidak
direferensikan FK apa pun yg sudah ada). Pola pivot PERSIS 3 junction
table label (`0005_labels.sql`: `transaction_labels`/
`category_labels`/`account_labels`) — `id` UUIDv7 dari caller (SAMA
PERSIS nilai `id` baris ybs di SQLite lokal desktop, bukan
server-generate), `UNIQUE(period_id, category_id)` cegah duplikat,
kolom LWW nullable TANPA default (beda dari desktop SQLite yg pakai
trigger — Worker SELALU isi eksplisit saat INSERT/UPDATE):

```sql
CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE TABLE category_period_categories (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (period_id, category_id)
);
CREATE INDEX idx_category_period_categories_period ON category_period_categories(period_id);
CREATE INDEX idx_category_period_categories_category ON category_period_categories(category_id);
```

Kolom LWW (`updated_at`/`deleted_at`/`sync_source`) disertakan dari
migrasi PERTAMA — beda dari investasi yang nambah belakangan di
`0042`/`0002`, krn di sini sync sudah diputuskan perlu dari awal
(lihat index root).

### Modul `category-periods/`

Resource paling sederhana dibanding modul lain yang ada (`debts`,
`investments`) — TIDAK ada logic bisnis bersyarat (tidak ada FIFO,
average cost, status pending/settled). Satu-satunya kerumitan
tambahan (dibanding rencana awal 1-tabel) adalah pivot many-to-many:

- `upsertCategoryPeriod` — INSERT/UPDATE `category_periods` dgn LWW,
  pola PERSIS `categories/service.ts` `upsertCategory` (field lebih
  sedikit). Payload JUGA bawa `categoryIds: string[]` — sesudah
  upsert periode-nya sendiri, REPLACE SELURUH baris pivot milik
  periode itu (DELETE semua baris `category_period_categories WHERE
  period_id = ?`, lalu INSERT ulang per `categoryIds`, id tiap pivot
  dari payload juga) — bukan diff, pola PERSIS desktop
  `useUpdateCategoryPeriod`. Konsekuensi: payload push dari desktop
  WAJIB sertakan daftar `id` pivot yg dipakai (desktop generate UUID
  baru tiap kali replace, sama kasus insert awal) — BUKAN Worker yg
  generate id pivot sendiri.
- `deleteCategoryPeriod` — soft-delete `category_periods` saja (pola
  `account-groups/service.ts`). Baris pivot TIDAK di-soft-delete
  manual terpisah — cukup biarkan menggantung (`deleted_at` di induk
  sudah cukup utk query ringkasan/snapshot filter `deleted_at IS
  NULL` di induknya), KECUALI kalau nanti ada kebutuhan hard-delete
  (baru CASCADE beneran kepakai, sama catatan `0005_labels.sql`
  soal CASCADE cuma utk hard-delete).
- `getCategoryPeriodSummary(env, periodId)` — query SELECT periode
  by id, lalu `SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0
  END), SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) FROM
  transactions WHERE category_id IN (SELECT category_id FROM
  category_period_categories WHERE period_id = ?1 AND deleted_at IS
  NULL) AND date BETWEEN ?2 AND ?3 AND deleted_at IS NULL`. TIDAK
  disimpan/dicache — dihitung tiap panggil, sama prinsip
  `accounts.balance`, match persis query desktop
  (`useCategoryPeriodSummary`, `features/reports/content/category-period-summary/`).

Endpoint (`router.ts`, `requireAuth` semua, pola `categories/router.ts`):
- `POST /category-periods/push` — upsert-by-id dari desktop, payload
  termasuk `categoryIds`.
- `DELETE /category-periods/push/:id` — soft-delete dari desktop.
- `GET /category-periods/:id/summary` — ringkasan (dipakai jalur
  Worker generik kalau ada; kemungkinan TIDAK dipakai langsung dari
  MCP krn MCP baca dari snapshot `/sync`, lihat catatan di bawah).

### Perluasan `/sync`

`sync/service.ts`: `SyncResponse` + `getSyncSnapshot` tambah
`categoryPeriods` — tiap baris SUDAH di-JOIN dgn `categoryIds:
string[]` (hasil `GROUP_CONCAT`/agregasi dari
`category_period_categories`, mirip pola `category_names` di query
list desktop), BUKAN baris pivot mentah terpisah yg masih perlu
di-assemble sisi MCP. Pola sama 7 tabel lain yang sudah ada. Ini yg
dipakai `apps/mcp-server` (`fetchFullSnapshot`) utk tool baca — BUKAN
endpoint `/summary` di atas (konsisten dgn pola investasi: MCP hitung
sendiri dari snapshot pakai data `transactions` yg sudah ada di situ
juga, bukan request terpisah per periode).

### Yang SENGAJA tidak dibuat

- Tidak ada validasi bisnis kompleks (tidak ada "periode tidak boleh
  overlap", dst) — kalau nanti dibutuhkan, catat sbg keputusan baru,
  bukan asumsi dari awal.
- Tidak ada endpoint khusus "list periode per kategori" di Worker —
  cukup lewat snapshot `/sync` (MCP) atau desktop query SQLite
  lokalnya sendiri (tidak perlu round-trip ke Worker utk baca data
  miliknya sendiri).
- Tidak ada endpoint pivot terpisah (mis. `POST
  /category-periods/:id/categories`) — pivot SELALU ikut payload
  upsert periode induknya (replace-all), bukan dikelola independen.

## Catatan

- Belum ada urgensi/deadline — proyek portofolio-only.
- Urutan kerja disarankan: desktop (skema+UI) dulu supaya bentuk data
  final, baru direplikasi ke sini — lihat index root.

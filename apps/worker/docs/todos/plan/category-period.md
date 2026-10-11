# Periode Kategori — Worker

> Detail implementasi sisi `apps/worker` utk fitur lintas-app
> "Periode Kategori". Index navigasi + status lintas-app ada di
> [`docs/todos/plan/category-period-sync.md`](../../../../../docs/todos/plan/category-period-sync.md)
> (root repo) — JANGAN duplikasi isi ke sana, cukup pointer status.

## Status & TODO saat ini (ringkas)

Baru tahap rencana — belum ada kode/migrasi ditulis. Lihat bagian
"Rencana pendekatan" di bawah utk detail.

- [ ] Migrasi D1 `schema/NNNN_category_periods.sql` — `CREATE TABLE`
  murni (tabel baru, tidak direferensikan FK tabel lain → tidak perlu
  pola copy-and-rename seperti migrasi `accounts`).
- [ ] Modul `category-periods/` (`schema.ts`/`service.ts`/
  `controller.ts`/`router.ts`, pola `categories/`) — CRUD upsert-by-id
  dgn LWW (`shared/lww.ts`, pola persis `categories/service.ts`) +
  soft-delete.
- [ ] Query ringkasan on-the-fly (total masuk/keluar/selisih + daftar
  transaksi) berdasar `category_id` + `start_date`/`end_date` —
  SUM/SELECT langsung ke `transactions`, tidak ada tabel agregat.
- [ ] Endpoint push (`POST /category-periods/push`,
  `DELETE /category-periods/push/:id`) utk jalur sync PC, pola persis
  `pushDebtFromPc`/`deletePushedDebt`.
- [ ] Didaftarkan di `src/index.ts` (`.route("/category-periods", ...)`).
- [ ] Perluasan `/sync` snapshot (`sync/service.ts`) — tambah
  `categoryPeriods` ke `SyncResponse`/`getSyncSnapshot`, pola sama
  7 tabel lain yang sudah ada.
- [ ] Verifikasi lokal via `wrangler dev` + `d1 execute --local`
  (pola `checking-dev-database.md` desktop) sebelum deploy.
- [ ] Deploy ke `--remote`/production — DITUNDA sampai modul ini
  siap & diverifikasi lokal, dan desktop sudah siap push.

## Rencana pendekatan

### Skema D1

`category_periods` — `CREATE TABLE` murni (tidak perlu copy-and-rename
krn tabel BARU, tidak direferensikan FK apa pun, sama kasus
`investment_accounts` dkk di `investment-sync.md` Tahap 1):

```sql
CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    sync_source TEXT NOT NULL
);
CREATE INDEX idx_category_periods_category ON category_periods(category_id);
```

Kolom LWW (`updated_at`/`deleted_at`/`sync_source`) disertakan dari
migrasi PERTAMA — beda dari investasi yang nambah belakangan di
`0042`/`0002`, krn di sini sync sudah diputuskan perlu dari awal
(lihat index root).

### Modul `category-periods/`

Resource paling sederhana dibanding modul lain yang ada (`debts`,
`investments`) — TIDAK ada logic bisnis bersyarat (tidak ada FIFO,
average cost, status pending/settled). Isinya murni:

- `upsertCategoryPeriod` — INSERT/UPDATE dgn LWW, pola PERSIS
  `categories/service.ts` `upsertCategory` (lihat file itu sbg
  template langsung, field lebih sedikit).
- `deleteCategoryPeriod` — soft-delete, pola `account-groups/service.ts`
  (tabel yg tidak punya relasi anak kompleks, beda dari `categories`
  yg perlu urus sub-kategori+transaksi dulu).
- `getCategoryPeriodSummary(env, periodId)` — query SELECT periode
  by id, lalu `SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0
  END), SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) FROM
  transactions WHERE category_id = ?1 AND date BETWEEN ?2 AND ?3 AND
  deleted_at IS NULL`. TIDAK disimpan/dicache — dihitung tiap panggil,
  sama prinsip `accounts.balance`.

Endpoint (`router.ts`, `requireAuth` semua, pola `categories/router.ts`):
- `POST /category-periods/push` — upsert-by-id dari desktop.
- `DELETE /category-periods/push/:id` — soft-delete dari desktop.
- `GET /category-periods/:id/summary` — ringkasan (dipakai jalur
  Worker generik kalau ada; kemungkinan TIDAK dipakai langsung dari
  MCP krn MCP baca dari snapshot `/sync`, lihat catatan di bawah).

### Perluasan `/sync`

`sync/service.ts`: `SyncResponse` + `getSyncSnapshot` tambah
`categoryPeriods` (array baris `category_periods` yg `deleted_at IS
NULL`), pola sama 7 tabel lain. Ini yg dipakai `apps/mcp-server`
(`fetchFullSnapshot`) utk tool baca — BUKAN endpoint `/summary` di
atas (konsisten dgn pola investasi: MCP hitung sendiri dari snapshot
pakai data `transactions` yg sudah ada di situ juga, bukan request
terpisah per periode).

### Yang SENGAJA tidak dibuat

- Tidak ada validasi bisnis kompleks (tidak ada "periode tidak boleh
  overlap", dst) — kalau nanti dibutuhkan, catat sbg keputusan baru,
  bukan asumsi dari awal.
- Tidak ada endpoint khusus "list periode per kategori" di Worker —
  cukup lewat snapshot `/sync` (MCP) atau desktop query SQLite
  lokalnya sendiri (tidak perlu round-trip ke Worker utk baca data
  miliknya sendiri).

## Catatan

- Belum ada urgensi/deadline — proyek portofolio-only.
- Urutan kerja disarankan: desktop (skema+UI) dulu supaya bentuk data
  final, baru direplikasi ke sini — lihat index root.

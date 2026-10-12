# Modul `sync`

Endpoint **pull** untuk sinkronisasi database lokal PC (desktop app) dengan D1 di Cloudflare Worker. Satu-satunya route: `GET /sync?since=`.

Ini bukan modul sync dua-arah yang lengkap. Sisi **push** (create/update/delete) tidak ada di sini — tersebar sebagai operasi CRUD biasa di modul per-domain lain (`modules/accounts`, `modules/transactions`, `modules/debts`, dst), yang juga jadi jalur tulis tool MCP (operasi dari HP via Claude). D1 punya 2 sumber tulis: PC dan tool MCP, karena itu PC wajib **pull-sebelum-push** memakai endpoint ini, dengan resolusi konflik last-write-wins via `updated_at` (lihat `shared/lww.ts`).

## Alur `GET /sync?since=`

- `since` kosong/tidak dikirim → first sync, kembalikan snapshot PENUH semua baris di semua tabel (termasuk baris yang `deleted_at` terisi — PC wajib tahu baris mana yang sudah dihapus di sisi lain, bukan cuma baris hidup).
- `since` terisi → cuma baris yang `updated_at > since` (string-compare leksikografis, karena `updated_at` disimpan sebagai TEXT format `YYYY-MM-DD HH:mm:ss`, lihat `shared/lww.ts`). Validasi format dilakukan di `schema.ts` (`parseSinceParam`/`isValidUpdatedAt`).
- Response membawa `checkpoint`: waktu Worker **memproses** request ini (bukan `since` yang dikirim caller). Diambil SEBELUM query jalan, bukan sesudah — supaya baris yang berubah pas saat query berjalan tetap tercakup di pull berikutnya (menghindari celah "berubah tepat di antara query dan checkpoint diambil"). PC simpan nilai ini sebagai checkpoint untuk pull selanjutnya.

## Struktur file

- `router.ts` — registrasi route, pasang `requireAuth` middleware.
- `controller.ts` — parse query param, panggil service, bentuk response HTTP. Autentikasi ditangani middleware di `router.ts`, bukan di sini.
- `schema.ts` — validasi query param `since`.
- `service/index.ts` — orkestrasi: panggil semua fetcher di `entities/` lewat `Promise.all`, assemble jadi satu `SyncResponse`.
- `service/entities/*.ts` — satu file per tabel/entitas. Tiap file isinya 3 bagian: row type snake_case (bentuk mentah hasil query, private), row type camelCase (bentuk response, exported), dan fungsi `fetchX(env, filter, bind)` yang jalankan query + mapping.

Field camelCase di response dijaga KONSISTEN dengan payload endpoint tulis (lihat `docs/todos/plan/cloud-sync.md`, bagian "Progress implementasi" > endpoint pull) — supaya PC bisa reuse field yang sama kalau mau push ulang baris ini tanpa mapping manual snake_case↔camelCase.

### Kasus khusus: `entities/category-periods.ts`

Satu-satunya entitas yang query-nya JOIN (ke `category_period_categories`, pakai `GROUP_CONCAT` untuk kolom `category_ids`, dipisah koma lalu di-split jadi array di JS — supaya MCP tidak perlu assemble sendiri dari tabel pivot, lihat "Perluasan /sync" di `docs/todos/plan/category-period.md`). Karena itu:

- Pakai `LEFT JOIN` (bukan `INNER JOIN` seperti query list desktop) karena periode TANPA kategori sekalipun tetap harus muncul di snapshot.
- Filter `since` HARUS qualified (`category_periods.updated_at > ?1`), bukan string generik `"WHERE updated_at > ?1"` yang dipakai 14 entitas lain — kolom `updated_at` ambigu kalau tidak di-prefix nama tabel, karena ada di kedua tabel yang di-JOIN.
- Filter `since` HANYA di kolom `category_periods.updated_at` (induk). Baris pivot ikut terbawa lewat `GROUP_CONCAT` apa adanya, tidak difilter sendiri — konsisten dengan keputusan `deleteCategoryPeriod` yang juga tidak menyentuh tabel pivot.
- Karena filter-nya khusus, `fetchCategoryPeriods` menerima `since` mentah dan membangun filter qualified-nya sendiri di dalam file, bukan menerima `filter`/`bind` generik dari `service/index.ts` seperti 14 fetcher lainnya.

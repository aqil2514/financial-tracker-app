# Kategori `is_active` — Celah di Laporan & Mapping Retailku

> Dicatat 2026-10-04 dari hasil audit ad-hoc (bukan investigasi
> terstruktur) — belum ada sesi kerja utk ini. Semua temuan ada di
> `apps/desktop` (laporan breakdown kategori, opsi mapping Retailku,
> query dasar kategori) — sempat salah ditaruh di `apps/worker`, sudah
> dipindah ke sini (2026-10-04).

## Status & TODO saat ini (ringkas)

- [x] `use-category-breakdown.ts` (laporan breakdown kategori per bulan,
      `apps/desktop`) — difix 2026-10-05, tambah `AND c.is_active = 1`.
      Lihat bagian "Temuan" di bawah untuk konteks awal.
- [x] Opsi kategori di mapping Retailku (`use-resources.ts`) tidak
      filter `is_active` — dipindah ke dokumen tersendiri 2026-10-05,
      lihat
      [retailku-mapping-category-inactive-gap.md](../plan/retailku-mapping-category-inactive-gap.md)
      (butuh sesi khusus Retailku, bukan bagian dari audit umum ini).
- [x] Filter status di list kategori (`category-list.tsx`) — diputuskan
      2026-10-05: TETAP in-memory (BUKAN disamakan ke SQL `WHERE` +
      pagination seperti Akun), karena data kategori hierarkis
      (parent-child, accordion) & kecil, grouping-nya butuh seluruh
      pohon di client sehingga bertentangan dengan pagination SQL per
      baris. Satu gap nyata yang tersisa dari pola in-memory ini (filter
      hilang saat navigasi) sudah diperbaiki dengan persist
      search/type/status ke URL lewat nuqs (`?search=&type=&status=`),
      tanpa mengubah ke SQL `WHERE`.

## Latar belakang

Audit ad-hoc (2026-10-04, trigger: pertanyaan "apakah `is_active` cuma
dipakai di Akun?") menemukan `categories` juga punya kolom `is_active`
(sejak `migrations/0008_active_flag.sql`), tapi cakupan pemakaiannya
lebih sempit dan kurang konsisten dibanding pola di `accounts` — bukan
"pajangan total" (toggle create/edit jalan, dropdown pemilih kategori di
form transaksi sudah filter `is_active` sama lengkap dengan akun), tapi
ada 2 celah nyata dibanding akun sebagai rujukan.

## Temuan (perbandingan Akun vs Kategori)

| Aspek | Akun | Kategori |
|---|---|---|
| Toggle di form create/edit | Ada | Ada — **sama lengkap** |
| Dropdown pemilih di form transaksi | Filter `is_active` + exception utk id yang sedang dipakai | Filter `is_active` + exception serupa — **sama lengkap** |
| Filter di list (implementasi) | SQL `WHERE is_active = 1` dinamis, persist di URL (nuqs) | JS `.filter()` di memori atas `SELECT *` (`use-categories.ts`), state lokal hilang saat navigasi |
| Laporan/report | `use-account-balances.ts` filter `WHERE a.is_active = 1` | `use-category-breakdown.ts` **tidak filter sama sekali** |
| Opsi mapping Retailku | Filter `is_active` eksplisit (`use-resources.ts`/`use-sync-prerequisites.ts` utk account options) | **Tidak difilter** — `categoryOptions: categories ?? []` apa adanya |
| Worker (server-side) | Hanya persist, tidak ada filter baca di SELECT manapun | Sama — hanya persist, tidak ada filter baca |

Detail file:baris (per audit 2026-10-04, bisa basi — verifikasi ulang
sebelum eksekusi):
- `apps/desktop/src/features/reports/use-category-breakdown.ts` — JOIN
  ke `categories` tanpa `WHERE is_active = 1`, padahal
  `use-account-balances.ts` (counterpart akun) memfilternya.
- `apps/desktop/src/hooks/resources/use-categories.ts` — query dasarnya
  `SELECT * FROM categories ORDER BY name`, tanpa `WHERE` sama sekali
  (konsisten dgn keputusan "filter di client", tapi jadi akar kenapa
  laporan & mapping gampang lupa filter ulang di tempat pakainya).

## Catatan

Gap mapping Retailku (opsi kategori belum filter `is_active`) sudah
dipindah ke dokumen tersendiri — lihat
[retailku-mapping-category-inactive-gap.md](../plan/retailku-mapping-category-inactive-gap.md)
untuk detail & alasan kenapa butuh sesi khusus.

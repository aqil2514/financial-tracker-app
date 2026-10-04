# Kategori `is_active` — Celah di Laporan & Mapping Retailku

> Dicatat 2026-10-04 dari hasil audit ad-hoc (bukan investigasi
> terstruktur) — belum ada sesi kerja utk ini. Semua temuan ada di
> `apps/desktop` (laporan breakdown kategori, opsi mapping Retailku,
> query dasar kategori) — sempat salah ditaruh di `apps/worker`, sudah
> dipindah ke sini (2026-10-04).

## Status & TODO saat ini (ringkas)

- [ ] `use-category-breakdown.ts` (laporan breakdown kategori per bulan,
      `apps/desktop`) tidak filter `is_active` — kategori nonaktif bisa
      tetap muncul di laporan. Lihat bagian "Temuan" di bawah.
- [ ] Opsi kategori di mapping Retailku (`use-resources.ts`, `apps/desktop`)
      tidak filter `is_active` — kategori nonaktif tetap jadi pilihan
      valid saat mapping field Retailku. Butuh sesi khusus Retailku
      (lihat catatan di bawah), bukan fix satu baris berdiri sendiri.
- [ ] Filter status di list kategori (`category-list.tsx`) masih
      client-side in-memory, BEDA pola dari Akun yang sudah SQL `WHERE`
      + persist di URL (nuqs). Belum diputuskan apakah ini perlu
      disamakan atau dibiarkan (list kategori biasanya jauh lebih
      sedikit baris daripada akun, jadi in-memory filter mungkin memang
      cukup) — keputusan ditunda ke sesi ini.

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
- `apps/desktop/src/shared/retailku/mcp-hooks` atau modul resources
  Retailku terkait (`use-resources.ts`) — `categoryOptions` dari
  `categories` apa adanya, tanpa filter `is_active`; bandingkan dengan
  opsi akun Retailku yang sudah filter `is_active` eksplisit.
- `apps/desktop/src/hooks/resources/use-categories.ts` — query dasarnya
  `SELECT * FROM categories ORDER BY name`, tanpa `WHERE` sama sekali
  (konsisten dgn keputusan "filter di client", tapi jadi akar kenapa
  laporan & mapping gampang lupa filter ulang di tempat pakainya).

## Kenapa ditunda ke sesi khusus Retailku

Perbaikan opsi mapping Retailku bukan sekadar nambah `.filter(c =>
c.is_active)` satu baris — perlu dipikirkan juga: bagaimana kalau ada
mapping LAMA yang sudah menunjuk ke kategori yang KEMUDIAN dinonaktifkan
(pola exception "tetap muncul kalau sedang dipakai", sama seperti
dropdown kategori form transaksi)? Itu butuh pengecekan behavior
mapping existing dulu sebelum tahu bentuk fix yang benar — user sudah
bilang bagian Retailku butuh sesi khusus terpisah.

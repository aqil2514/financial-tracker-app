# Porting Akun Tipe Valas (Desktop → Mobile)

Dokumen anak dari [forex-sync.md](../../../../../docs/todos/plan/forex-sync.md) (index lintas-app). Pola mengikuti [porting-account-investment.md](../done/porting-account-investment.md). Konsep: [konsep-valas.md](../../../../../docs/concept/konsep-valas.md). Acuan logic: `apps/desktop/src/shared/forex/` (rumus average cost valas memakai posisi tersisa, jangan disalin dari `shared/investments/`). Skema: [forex.md](../../tables/forex.md).

## Status & TODO saat ini (ringkas)

Keputusan (2026-11-07): cakupan penuh tahap 1 sampai 5; edit baris riwayat beli/jual dilewati dulu (sama seperti desktop); layar khusus saja, akun valas disembunyikan permanen dari picker transaksi.

- [x] Tahap 1: migrasi `0018_account_type_forex.ts` (CHECK akun) dan `0019_forex.ts` (3 tabel, trigger, CHECK antrean), terdaftar di `migrations/index.ts`, test migrasi di SQLite asli lulus, `docs/tables/forex.md`.
- [x] Tahap 2: logic `shared/forex/` (holding math, beli dari kas dan tanpa kas, jual dengan realized P/L, update kurs, detach saat hapus transaksi, guard hapus pembelian) + test SQLite asli; `classifyAccountPair` (`cash-forex`, `forex-cash`) + guard no-op `applyDebtTransaction`.
- [x] Tahap 3: sync mobile (`types.ts`, `push-request.ts`, `flush-push-queue.ts`, `enqueue-all.ts`, `pull-types.ts`, `apply-sync-response.ts`) + test.
- [x] Tahap 4 (kode selesai 2026-11-07, dicoba di device sama hari): layar `app/forex/` (ringkasan, detail, Beli, Jual) + sheet Update Kurs dengan toggle Kurs/Nilai total (`features/forex/`), kueri `shared/forex/forex-queries.ts` (test SQLite asli), tipe Valas di form akun (negara, mata uang, kurs; saldo awal dikunci 0), badge, guard picker permanen (`hideForexType`, tiga kueri `NOT IN`), edit akun (hapus ditolak kalau punya riwayat beli/jual), edit transaksi valas ditolak lewat form umum, hapus transaksi ikut `detachForexForDeletedTransaction` (hapus pembelian yang unitnya terjual ditolak), laporan Per Tipe Akun (nilai terkini valas), menu `more.tsx`.
- [x] Tahap 5 (2026-11-07): uji di device lulus untuk buat akun, beli, jual, update kurs, hapus transaksi, dan sync dua arah dengan desktop (log Worker lokal semua 2xx; 404 pada DELETE valas = baris sudah ikut terhapus cascade, ditangani idempoten oleh desktop).
- [x] Verifikasi otomatis: 465 test mobile lulus, `tsc --noEmit` hanya mengeluh 3 rute `/forex/...` (typed routes basi, hilang setelah dev server Expo dijalankan ulang, lihat memory project_mobile_expo_typed_routes_stale).
- [ ] Sisa di luar cakupan awal: edit baris riwayat beli/jual (seperti desktop, belum), toggle nilai total di form Jual sudah ada tetapi belum diuji khusus di device.

# Sync Tipe Akun Valas ke Cloud dan Mobile — Index Navigasi

> Index navigasi untuk satu fitur lintas-app: valas ikut sync cloud dan tersedia di mobile, melanjutkan desktop yang sudah selesai. Lihat [`../README.md`](../README.md) untuk struktur `docs/todos/{plan,done}/`. Detail desktop ada di [`apps/desktop/docs/todos/plan/account-type-forex.md`](../../../apps/desktop/docs/todos/plan/account-type-forex.md), konsep di [`docs/concept/konsep-valas.md`](../../concept/konsep-valas.md).

## Status & TODO saat ini (ringkas)

Keputusan cakupan (2026-11-07): end to end = desktop + Worker + mobile, tanpa MCP. Worker memakai **logic penuh seperti investasi** (bukan cermin saja), pola sama [investment-sync.md](../done/investment-sync.md). Detail tiap tahap ada di bagian bawah.

- [x] Desktop: tipe akun, skema, logic beli/jual, layar, dialog (selesai dan sudah dipakai dengan data nyata).
- [x] Worker: migrasi D1 `schema/0011_account_type_forex.sql` ditulis dan diverifikasi di SQLite lokal (skema + isi 13 tabel lama identik, FK bersih).
- [x] Worker: `0011` dicoba pada SALINAN D1 lokal asli (97 akun, 5.698 transaksi): jumlah baris tabel lama tidak berubah, FK bersih, `integrity_check` ok. D1 lokal milik user sendiri BELUM disentuh.
- [x] Worker: `shared/account-types.ts` (+ `forex` di daftar yang tidak boleh koreksi saldo langsung), `debts/classify-account-pair.ts` (`cash-forex`, `forex-cash`), dan `debts/service.ts` (pasangan valas = noop di logic debt, kalau tidak jatuh ke cabang debt).
- [x] Worker: modul `forex/` (`schema`, `service`, `controller`, `router`) di-mount di `/forex`: push akun/pembelian/penjualan, hapus push, `POST /forex/purchases` (dari kas atau tanpa kas), `POST /forex/sales` (average cost atas posisi tersisa, validasi oversell, idempoten lewat `id`).
- [x] Worker: integrasi `transactions/` — transaksi valas dari sumber non-PC ditolak 422 (create dan update), hapus transaksi ikut soft-delete riwayat valas beserta transaksi pasangan penjualan.
- [x] Worker: `sync/` — tiga entity baru di respons pull (`forexAccounts`, `forexPurchases`, `forexSales`).
- [x] Worker: diverifikasi end-to-end pada salinan D1 terisolasi, `wrangler dev` di port 8799 (8787 milik user tidak disentuh): 35 skenario lulus, termasuk jalur push penjualan dengan bentuk payload yang sama dengan client desktop. `tsc --noEmit` Worker bersih. Skrip uji ada di scratchpad sesi, belum jadi bagian repo.
- [x] Gap ditemukan di uji dan DITUTUP (2026-11-07): menghapus pembelian yang unitnya sudah terpakai penjualan membuat sisa unit negatif (uji: hapus pembelian 100 unit setelah 135 unit terjual, sisa −70). Kini hapus transaksi pembelian valas ditolak kalau sisa unit setelahnya < 0, pesannya mengarahkan menghapus penjualan dulu. Desktop: `shared/forex/assert-forex-purchase-deletable.ts` di `use-delete-transaction.ts` (dicek SEBELUM push ke Worker), 4 test. Worker: `validateForexPurchaseDeletable`, hapus transaksi mengembalikan 422, 5 skenario baru di uji end-to-end (total 29 lulus). Endpoint `DELETE /forex/purchases/push/:id` sengaja tanpa guard: ia mencerminkan penghapusan yang sudah divalidasi klien.
- [ ] **Apply `0011` ke D1 remote dan `wrangler deploy` — hanya setelah persetujuan eksplisit user.**
- [x] Desktop sync (2026-11-07): migrasi `0058` (CHECK `cloud_sync_queue` + tiga tabel valas, dan `category_periods` yang terlewat sejak 0055), `QueueableTable`, client Worker + push-row untuk 3 tabel, `pushOnWrite` di buat/edit akun, update kurs, beli, jual, `pushDeleteOnWrite` di hapus transaksi (riwayat beli/jual dan transaksi pasangan penjualan), pull-sync (3 koleksi + test regresi dispatch pull), backfill ("Titik awal sync") ikut mendorong tabel valas, skip valas di `push-account-row.ts` dicabut. `tsc` bersih, vitest 332 lulus, test Rust migrasi 12 lulus. Belum dicoba dari aplikasi nyata ke Worker.
- [x] **Deploy production selesai (2026-11-07, atas persetujuan eksplisit user):** cadangan D1 remote diekspor lebih dulu, `0011` diuji pada restore cadangan itu (jumlah baris identik, FK bersih), lalu di-apply ke D1 remote (23 tabel, `success: true`) dan diverifikasi langsung (jumlah baris 13 tabel sama dengan cadangan, tiga tabel valas ada dan kosong, FK bersih, `CHECK` menerima `forex`). `wrangler deploy` versi `3471b415-90da-448a-9c77-3187f2be6d3a` dari commit `09edab8`. Smoke test: `/health` 200, `POST /forex/accounts/push` tanpa token 401 (rute ada). Skenario berotorisasi belum dijalankan di production (token production bukan di `.dev.vars`, dan sengaja tidak membuat data uji di production). Cadangan ada di scratchpad sesi, bukan di repo.
- [ ] Setelah deploy: jalankan backfill ("Titik awal sync") sekali supaya akun, transaksi, dan riwayat valas yang dicatat sebelum sync ada ikut terkirim.
- [ ] Mobile: ditentukan setelah desktop sync selesai (baca struktur mobile dulu: migrasi SQLite lokal, layar khusus Valas, akun valas disembunyikan dari picker transaksi).

## Aturan kerja yang berlaku

- `wrangler dev` di 8787 milik user hot-reload dari `apps/worker`: jangan tinggalkan file Worker rusak di tengah edit, uji di port 8799.
- Token di `.dev.vars` bukan secret production. Apply remote dan deploy butuh persetujuan eksplisit user, jangan dilakukan sebagai efek samping.
- Keputusan logic penuh berarti revisi logic valas di desktop wajib di-port manual ke Worker (dan sebaliknya), seperti investasi. Rumus average cost valas memakai posisi tersisa, bukan rumus investasi — jangan disalin dari modul `investments/`.

## Tahap Worker

Skema final di [`apps/desktop/docs/tables/forex.md`](../../../apps/desktop/docs/tables/forex.md). Beda Worker: tiap tabel punya `created_at` tanpa default plus `updated_at`/`deleted_at`/`sync_source`, dan soft-delete (`UPDATE deleted_at`), bukan hard `DELETE`. `0011` mengikuti pola `0010_account_type_third_party.sql`: rebuild `accounts` beserta 12 tabel anak, ditambah `third_party_funds` yang di `0010` dibuat sesudah rebuild-nya.

## Catatan

- Tabel `transaction_attachments` tidak ikut terisi saat verifikasi skrip (nama kolom seed berbeda), jadi isinya belum terbukti identik sebelum dan sesudah. Strukturnya (kolom, FK, index) terbukti identik. Cek isinya di D1 lokal saat apply.

# Tipe Akun Investasi

## Status & TODO saat ini (ringkas)

Model data sudah disepakati secara konsep (2026-10-06, lihat [docs/concept/konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md)) — dokumen ini mencatat breakdown kerja implementasi + daftar fitur turunan yang dipertimbangkan. Belum ada satu pun baris kode ditulis.

- [ ] Migrasi: tambah `'investment'` ke CHECK constraint `accounts.account_type` (teknik copy-and-rename, lihat `docs/rules/sqlite-copy-and-rename-migration.md`).
- [ ] Migrasi: tabel baru `investment_accounts` (1:1 dengan `accounts`) — kolom `unit_label`, `current_price_per_unit`, `updated_at`.
- [ ] Migrasi: tabel baru riwayat pembelian (nama kerja `investment_purchases`) — kolom `account_id`, `transaction_id`, `unit`, `price_per_unit`, `date`, `status` (`pending`/`settled`, default `pending`, untuk kasus settlement tertunda seperti reksadana T+1/T+2).
- [ ] Logic: `applyInvestmentTransaction` (pola sama `applyDebtTransaction`) — dipanggil saat transfer kas→investment, membuat baris `investment_purchases` otomatis dari field unit+harga yang diisi user di form.
- [ ] Form transaksi: field "Jumlah Unit" + "Harga per Unit" WAJIB muncul saat akun tujuan transfer bertipe `investment` (mirip field khusus akun bertipe `debt` sekarang) — manual, independen, TIDAK divalidasi terhadap nominal transfer.
- [ ] Form akun investasi: input/edit `unit_label` dan `current_price_per_unit`.
- [ ] Fitur turunan inti — Unrealized P/L per akun: `(total_unit × current_price_per_unit) − accounts.balance`, ditampilkan NOMINAL dan PERSENTASE di detail akun. Persentase = "return posisi aktif" (berbasis `balance` saat ini, BUKAN return total historis sejak awal) — ditandai jelas di UI supaya tidak disangka beda dari aplikasi lain yang menghitung termasuk unit yang sudah dijual (lihat konsep, bagian "Persentase P/L").
- [ ] Fitur turunan inti — rincian riwayat pembelian per lot di halaman detail akun (tanggal, unit, harga beli, nilai saat itu).
- [ ] Fitur turunan — average cost per unit (`balance / total_unit`), ditampilkan sebagai metrik tambahan.
- [ ] Fitur turunan — breakdown laporan "Per Tipe Akun" ikut tampilkan total Unrealized P/L gabungan semua akun investasi (laporan sudah ada, lihat `reports-page-redesign.md`, tinggal diperluas).
- [ ] Fitur turunan — indikator "harga terkini diupdate X hari lalu" dari `investment_accounts.updated_at`, mendorong user update rutin.
- [ ] Fitur turunan — breakdown eksplisit 3 angka di halaman rincian investasi/laporan: total dana `pending`, total `settled`, dan gabungan keduanya (= cermin `accounts.balance`) — murni presentasi, TIDAK mengubah cara hitung `total_unit`/`balance` (lihat konsep, bagian "Settlement tertunda").
- [ ] Fitur turunan — MCP tool `get_investment_summary` (kalau diputuskan diekspos ke Claude dari HP) — BELUM diputuskan, scope ini bisa melebar ke `apps/mcp-server`/`apps/worker` kalau jalan, lihat `docs/todos/README.md` soal kapan dokumen lintas-app dipecah ke root.
- [ ] Pertanyaan terbuka BELUM diputuskan: FIFO/average cost saat penjualan sebagian + realized gain/loss (lihat [konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md) bagian "Pertanyaan terbuka").
- [ ] Utang desain dicatat sadar: kolom `status` (pending/settled) di `investment_purchases` adalah solusi SEMENTARA untuk settlement tertunda (reksadana T+1/T+2) karena tipe akun perantara `advance` belum dibangun — pendekatan akun perantara (dua transaksi: kas→advance→investment) lebih akurat tapi butuh `advance` ada dulu. TIDAK WAJIB dimigrasi begitu `advance` ada, cuma didiskusikan ulang kalau pendekatan sekarang terasa kurang.
- [ ] Migrasi data lama: akun existing yang masih `cash` tapi sebenarnya investasi — DITUNDA sampai tipe akun + fitur turunannya ini selesai dulu (keputusan eksplisit, bukan terlupa).

## Latar belakang

User sudah punya aset investasi nyata, tapi saat ini masih tercatat di akun bertipe `cash` karena tipe `investment` belum ada. `docs/concept/konsep-tipe-akun.md` sudah lama menyebut "Investasi" sebagai salah satu tipe yang akan menyusul, dan `apps/desktop/docs/todos/plan/account-type.md` sudah merencanakan arsitektur umum (tabel detail terpisah per tipe, pola `credit_accounts`/`investment_accounts`) — tapi field investasinya dulu baru dipikirkan sebagai model saham/reksadana formal (unit, harga per unit, return), belum ada keputusan final.

Diskusi 2026-10-06 merumuskan model final: dua lapis data (modal dari saldo akun seperti biasa, plus riwayat pembelian per lot dengan unit+harga) — ringkasan lengkap model datanya ada di [docs/concept/konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md), TIDAK diulang di sini supaya tidak ada dua sumber kebenaran yang bisa basi salah satu.

## Kenapa riset Retailku tidak menghasilkan pola yang di-reuse

Sempat dicek apakah "investasi Retailku" (fitur yang sudah ada di app ini untuk sync data toko) punya model teknis yang bisa ditiru — jawabannya TIDAK. Data investasi dari MCP Retailku (`capitalAmount`, `gainLoss`) tidak pernah disimpan/disinkron ke financial-app; transaksi `INVESTMENT_TRANSACTION` dari Retailku numpang di klasifikasi `"transfer"` generik (lihat `apps/desktop/docs/reference/retailku-cashflow-row-classification.md`). Begitu tipe `investment` ini ada, transaksi Retailku jenis ini BISA dipetakan ke sini — tapi itu kerja terpisah (mapping sync), bukan bagian dari dokumen ini.

## Urutan kerja yang disarankan

1. Migrasi skema dulu (3 item migrasi di checklist) — tanpa ini tidak ada yang bisa dibangun di atasnya.
2. Logic `applyInvestmentTransaction` + form transaksi (field unit/harga) — supaya riwayat pembelian bisa mulai terisi dari pemakaian nyata.
3. Form akun investasi (input `unit_label`/`current_price_per_unit`) — supaya nilai pasar terkini & Unrealized P/L bisa dihitung.
4. Baru lanjut ke fitur turunan (P/L, riwayat per lot, average cost, breakdown laporan, indikator staleness, MCP tool) — urutan di antara ini belum diprioritaskan, menyusul diskusi lanjutan.

## Catatan penting

- Field unit/harga di form transaksi WAJIB (bukan opsional) begitu akun tujuan bertipe `investment` — keputusan eksplisit, bukan default yang bisa dilewati.
- `accounts.balance` TIDAK PERNAH berubah akibat update `current_price_per_unit` — ini prinsip inti yang tidak boleh dilanggar implementasi apa pun nanti (lihat [konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md) bagian "Update harga per unit terkini TIDAK mengubah saldo akun").
- Agregat total kekayaan (dashboard, laporan) tetap pakai `balance`, BUKAN nilai pasar terkini — supaya tidak diam-diam mencampur dua basis penilaian berbeda.

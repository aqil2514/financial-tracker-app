# Porting Dashboard (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Keempat kartu sudah ada di tab Beranda (`features/dashboard/`, dipasang di `src/app/(tabs)/index.tsx`), lolos `tsc` dan tes, belum dicoba di perangkat dan belum diverifikasi angkanya terhadap desktop. Detail tiap poin ada di bagian "Isi dashboard desktop" dan "Catatan teknis" di bawah.

- [x] Keputusan isi Beranda mobile: tiga kartu tanpa grafik dulu (Total Saldo, Ringkasan Bulan Ini, Transaksi Terbaru), tren menyusul.
- [x] Kartu Total Saldo — hanya akun bertipe Kas aktif (`total-balance.tsx`, memakai `useBalancesByAccountType`). Beda dari desktop yang menjumlah semua tipe, lihat "Catatan teknis".
- [x] Kartu Ringkasan Bulan Ini — `month-summary.tsx`, memakai `useCashflowSummary` dan `IncomeExpenseCards` dari Laporan, jadi filternya sudah sama dengan desktop.
- [x] Kartu Tren 6 Bulan Terakhir — grafik batang pemasukan/pengeluaran per bulan (`trend-card.tsx`, `monthly-bar-chart.tsx`, query di `use-monthly-summary.ts`, bentuk data di `monthly-summary-rows.ts` dengan tes). Sentuh/seret untuk tooltip.
- [x] Kartu Transaksi Terbaru — 5 transaksi terakhir (`recent-transactions.tsx`), tap membuka halaman edit lewat `TransactionItem`.
- [x] Tentukan kaitan dengan tab Laporan: saldo dan ringkasan memakai hook Laporan langsung; tren ternyata tidak bisa dibagi (lihat "Catatan teknis").
- [ ] Verifikasi angka tiap kartu terhadap dashboard desktop dengan data yang sama.

## Isi dashboard desktop

Dashboard desktop (`apps/desktop/src/features/dashboard/`) terdiri dari 4 kartu:

- **Total Saldo** — jumlah `balance` dari `useAccountBalances` (`features/reports/use-account-balances.ts`): saldo awal + income − expense − transfer keluar + transfer masuk, hanya akun aktif.
- **Ringkasan Bulan Ini** — SUM income dan expense bulan berjalan.
- **Tren 6 Bulan Terakhir** — grafik dari `useMonthlySummary(6)` (`features/reports/use-monthly-summary.ts`).
- **Transaksi Terbaru** — `SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT 5`.

## Catatan teknis

- Ringkasan Bulan Ini di desktop memakai filter `is_cash_neutral = 0` dan `accounts.account_type != 'third_party'`, supaya transaksi netral kas dan dana pihak ketiga tidak dihitung sebagai pemasukan/pengeluaran. Mobile sudah punya kolom `is_cash_neutral` (migrasi `0006`) dan `shared/third-party-funds/cashflow-filter.ts`; pakai itu, jangan tulis ulang filternya.
- Rumus Total Saldo di desktop menjumlah semua akun aktif tanpa memandang tipe. Di mobile diputuskan hanya tipe `cash` (2026-11-06): dana pihak ketiga bukan milik sendiri, utang dan investasi punya konsep saldo sendiri (`docs/concept/konsep-investasi.md`). Akibatnya angka bisa berbeda dari Total Saldo desktop kalau ada akun non-kas; itu disengaja, bukan bug saat verifikasi.
- Transaksi Terbaru memakai `ORDER BY date DESC, created_at DESC LIMIT 5` tanpa filter lain, sama seperti daftar Transaksi mobile, jadi transaksi dana pihak ketiga ikut tampil.
- Mobile tidak punya React Query; pola yang dipakai query + `useFocusEffect` (lihat `use-transactions.ts`). Kartu dashboard sebaiknya mengikuti pola itu supaya angka segar tiap kembali dari form.
- Grafik batang digambar sendiri dengan `react-native-svg`, mengikuti pola grafik Laporan (lihat `done/porting-reports.md`), bukan `react-native-chart-kit`.
- Beda dari desktop di Tren: desktop mundur `N` bulan penuh sehingga memuat 7 bulan (termasuk bulan ini), mobile tepat 6 bulan berakhir di bulan ini; bulan tanpa transaksi diisi 0 (desktop melewatkannya). Filter transaksinya sama.
- Total Saldo berbagi query dengan tab Per Tipe Akun di Laporan. Tren 6 bulan TIDAK bisa berbagi dengan tab Tren Keuangan: itu grafik saldo (`balance-trend-query.ts`), sedangkan tren dashboard adalah pemasukan dan pengeluaran per bulan, query-nya terpisah.

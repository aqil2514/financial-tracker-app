# Porting Dashboard (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Baru tahap perencanaan, belum ada implementasi. Tab Beranda di mobile (`src/app/(tabs)/index.tsx`) hanya berisi `PageHeader` kosong. Detail tiap poin ada di bagian "Isi dashboard desktop" dan "Catatan teknis" di bawah.

- [ ] Keputusan isi Beranda mobile: 4 kartu desktop semua, atau subset dulu.
- [ ] Kartu Total Saldo — jumlah saldo semua akun aktif; cek konsistensi dengan saldo akun yang sudah ada di mobile.
- [ ] Kartu Ringkasan Bulan Ini — pemasukan/pengeluaran bulan berjalan, dengan filter yang sama seperti desktop (lihat "Catatan teknis").
- [ ] Kartu Tren 6 Bulan Terakhir — grafik pemasukan/pengeluaran per bulan (`react-native-chart-kit`).
- [ ] Kartu Transaksi Terbaru — 5 transaksi terakhir, tap membuka halaman edit.
- [ ] Tentukan kaitan dengan tab Laporan: kartu tren dan saldo memakai query yang sama dengan `porting-reports.md`, sebaiknya dibagi.
- [ ] Verifikasi angka tiap kartu terhadap dashboard desktop dengan data yang sama.

## Isi dashboard desktop

Dashboard desktop (`apps/desktop/src/features/dashboard/`) terdiri dari 4 kartu:

- **Total Saldo** — jumlah `balance` dari `useAccountBalances` (`features/reports/use-account-balances.ts`): saldo awal + income − expense − transfer keluar + transfer masuk, hanya akun aktif.
- **Ringkasan Bulan Ini** — SUM income dan expense bulan berjalan.
- **Tren 6 Bulan Terakhir** — grafik dari `useMonthlySummary(6)` (`features/reports/use-monthly-summary.ts`).
- **Transaksi Terbaru** — `SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT 5`.

## Catatan teknis

- Ringkasan Bulan Ini di desktop memakai filter `is_cash_neutral = 0` dan `accounts.account_type != 'third_party'`, supaya transaksi netral kas dan dana pihak ketiga tidak dihitung sebagai pemasukan/pengeluaran. Mobile sudah punya kolom `is_cash_neutral` (migrasi `0006`) dan `shared/third-party-funds/cashflow-filter.ts`; pakai itu, jangan tulis ulang filternya.
- Rumus Total Saldo di desktop tidak mengecualikan tipe akun tertentu. Perlu dicek apakah akun investasi, dana pihak ketiga, dan utang/piutang ikut terjumlah dengan benar menurut `docs/concept/konsep-investasi.md`, sebelum angkanya dipercaya di mobile.
- Mobile tidak punya React Query; pola yang dipakai query + `useFocusEffect` (lihat `use-transactions.ts`). Kartu dashboard sebaiknya mengikuti pola itu supaya angka segar tiap kembali dari form.
- Grafik hanya memakai `react-native-chart-kit`, sesuai keputusan permanen sebelumnya.
- Tren 6 bulan dan Total Saldo berbagi query dengan tab Laporan (`porting-reports.md`). Kerjakan sekali, pakai di dua tempat.

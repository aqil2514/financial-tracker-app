# Porting Halaman Laporan (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Baru tahap perencanaan, belum ada implementasi. Tab Laporan di mobile (`src/app/(tabs)/reports.tsx`) masih placeholder berisi satu bar chart dengan data dummy. Penjelasan tiap poin ada di bagian-bagian di bawah.

- [ ] Keputusan scope: porting semua 4 tab bertahap, atau cukup Cashflow + Per Tipe Akun dulu — belum diputuskan.
- [ ] Baca logika Cashflow di desktop (`apps/desktop/src/features/reports/content/cashflow/`) supaya hasil hitungan mobile sama persis.
- [ ] Ganti placeholder `reports.tsx` dengan struktur tab laporan (pola `TransactionTabSwitcher`) dan state bulan bersama.
- [ ] Tab Cashflow — kartu ringkasan pemasukan/pengeluaran, rincian per kategori, grafik harian, daftar transaksi.
- [ ] Tab Per Tipe Akun — saldo dikelompokkan per tipe akun.
- [ ] Tab Tren Keuangan — grafik saldo dari waktu ke waktu.
- [ ] Tab Periode Kategori — ringkasan anggaran per periode kategori, pie chart dan line chart.
- [ ] Verifikasi angka tiap tab terhadap desktop dengan data yang sama.

## Latar belakang

Desktop punya halaman laporan dengan 4 tab (`apps/desktop/src/features/reports/content/index.tsx`): Cashflow, Per Tipe Akun, Tren Keuangan, dan Periode Kategori. Mobile belum punya satupun, hanya placeholder.

## Peta tab desktop → mobile

- **Cashflow** — ringkasan pemasukan/pengeluaran, rincian per kategori, grafik transaksi harian, dan daftar transaksi. Paling berguna sehari-hari, dan sebagian datanya sudah ada di ringkasan halaman Transaksi (`use-transaction-summary.ts`).
- **Per Tipe Akun** — saldo dikelompokkan per tipe akun. Ringan: query dan daftar saja.
- **Tren Keuangan** — grafik saldo dari waktu ke waktu, butuh grafik garis.
- **Periode Kategori** — ringkasan anggaran per periode kategori dengan pie dan line chart. Paling berat, dikerjakan terakhir.

## Usulan urutan

1. Cashflow, memakai bulan yang sama seperti navigator halaman Transaksi.
2. Per Tipe Akun, karena murah dikerjakan.
3. Tren Keuangan.
4. Periode Kategori.

## Catatan teknis

- Grafik memakai `react-native-chart-kit`, sesuai keputusan permanen sebelumnya. Jangan pakai library chart lain.
- Akun investasi dan dana pihak ketiga punya konsep saldo sendiri — pegang `docs/concept/konsep-investasi.md` saat menghitung saldo/cashflow yang menyentuh keduanya.

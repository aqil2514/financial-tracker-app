# Porting Halaman Laporan (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Baru tahap perencanaan, belum ada implementasi. Tab Laporan di mobile (`src/app/(tabs)/reports.tsx`) masih placeholder berisi satu bar chart dengan data dummy. Penjelasan tiap poin ada di bagian-bagian di bawah.

- [ ] Keputusan scope: porting semua 4 tab bertahap, atau cukup Cashflow + Per Tipe Akun dulu — belum diputuskan.
- [x] Baca logika Cashflow di desktop (`apps/desktop/src/features/reports/content/cashflow/`) supaya hasil hitungan mobile sama persis.
- [x] Ganti placeholder `reports.tsx` dengan navigator bulan + `CashflowSection` — pindah antar tab laporan menunggu tab kedua ada.
- [x] Tab Cashflow, tahap 1 — kartu ringkasan, toggle Grup Akun/Kategori Induk, pie chart + daftar untuk pengeluaran dan pemasukan (`features/reports/cashflow/`).
- [ ] Tab Cashflow, tahap 2 — drill-down tap baris (daftar transaksi grup, filter anak, grafik harian) dan toggle "Label" (menunggu label di mobile).
- [ ] Verifikasi angka Cashflow tahap 1 terhadap desktop dengan data yang sama — belum dilakukan.
- [x] Tab Per Tipe Akun — pie chart + kartu per tipe (saldo, % dari total, Unrealized P/L untuk investasi), `features/reports/account-type/`. Belum diverifikasi terhadap desktop.
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

## Catatan implementasi Cashflow tahap 1

- Periode di mobile satu bulan penuh (navigator bulan bersama, `components/month-navigator.tsx`), bukan rentang bebas seperti `PeriodPicker` desktop.
- Query dan filter disalin dari desktop: `is_cash_neutral = 0` dan `EXCLUDE_THIRD_PARTY_TRANSACTIONS_SQL`; breakdown di-GROUP BY id (bukan nama), kategori anak digabung ke induknya.
- Dimensi "Label" desktop belum ada di mobile karena tabel label belum ada, lihat `porting-labels.md`.
- Pie chart memakai `PieChart` dari `react-native-chart-kit` tanpa lubang tengah (donut desktop tidak didukung library).
- Helper bulan (`currentMonth`, `shiftMonth`, `monthDateRange`) ada di `lib/utils/month.ts` dan dipakai bersama halaman Transaksi.

## Catatan implementasi Per Tipe Akun

- Rumus saldo dan filter akun aktif disalin dari desktop (`use-balances-by-account-type.ts`) dan sama dengan rumus saldo di `use-accounts.ts` mobile. Akun nonaktif tidak dihitung.
- Tab ini tidak terikat bulan (saldo saat ini), jadi navigator bulan di header hanya tampil di tab Cashflow.
- `PieChart` tidak bisa menggambar nilai negatif (mis. saldo utang), jadi pie hanya memuat tipe bertotal positif. Kartu tiap tipe tetap menampilkan total penuh, dan persentase dihitung terhadap jumlah semua tipe (termasuk negatif) seperti di desktop.
- Pie chart, helper data, dan palet dibagi dengan Cashflow di `features/reports/shared/`. `TabSwitcher` jadi komponen umum di `components/tab-switcher.tsx`, dipakai halaman Transaksi dan Laporan.

## Catatan teknis

- Grafik memakai `react-native-chart-kit`, sesuai keputusan permanen sebelumnya. Jangan pakai library chart lain.
- Akun investasi dan dana pihak ketiga punya konsep saldo sendiri — pegang `docs/concept/konsep-investasi.md` saat menghitung saldo/cashflow yang menyentuh keduanya.

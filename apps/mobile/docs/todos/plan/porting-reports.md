# Porting Halaman Laporan (Desktop → Mobile)

## Status & TODO saat ini (ringkas)

Semua 4 tab Laporan sudah ada di mobile (`src/app/(tabs)/reports.tsx`), sudah di-commit, di-build, dan angkanya dicek sama dengan desktop (2026-11-05). Sisa hanya toggle Label di Cashflow yang menunggu label di mobile. Penjelasan tiap poin ada di bagian-bagian di bawah.

- [x] Keputusan scope: porting semua 4 tab bertahap — diputuskan dan selesai.
- [x] Baca logika Cashflow di desktop (`apps/desktop/src/features/reports/content/cashflow/`) supaya hasil hitungan mobile sama persis.
- [x] Ganti placeholder `reports.tsx` dengan navigator bulan + `CashflowSection` — pindah antar tab laporan menunggu tab kedua ada.
- [x] Tab Cashflow, tahap 1 — kartu ringkasan, toggle Grup Akun/Kategori Induk, pie chart + daftar untuk pengeluaran dan pemasukan (`features/reports/cashflow/`).
- [x] Tab Cashflow, tahap 2 — drill-down tap baris menuju layar detail (`app/reports/cashflow-detail.tsx`): total, filter anak, grafik harian, daftar transaksi per hari yang bisa dibuka ke edit. Belum diverifikasi terhadap desktop.
- [ ] Toggle "Label" di Cashflow dan drill-down-nya — menunggu label di mobile (lihat `porting-labels.md`).
- [x] Verifikasi angka Cashflow tahap 1 terhadap desktop dengan data yang sama — sesuai.
- [x] Tab Per Tipe Akun — pie chart + kartu per tipe (saldo, % dari total, Unrealized P/L untuk investasi), `features/reports/account-type/`. Belum diverifikasi terhadap desktop.
- [x] Tab Tren Keuangan — grafik area saldo dengan preset rentang, granularitas, dan filter akun (`features/reports/balance-trend/`). Belum diverifikasi terhadap desktop.
- [x] Tab Periode Kategori — pemilih periode, kartu ringkasan, pie Pemasukan vs Pengeluaran atau grafik tren dua garis, dan daftar transaksi per tanggal (`features/reports/category-period/`). Belum diverifikasi terhadap desktop.
- [x] Verifikasi angka tiap tab terhadap desktop dengan data yang sama — sesuai di keempat tab.

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
- Pie chart digambar sendiri dengan `react-native-svg` (`features/reports/shared/breakdown-pie.tsx`, geometri di `donut-geometry.ts`), bukan `PieChart` chart-kit, supaya bisa berbentuk donut dengan sela antar irisan dan animasi terbuka melingkar seperti Recharts di desktop.
- Helper bulan (`currentMonth`, `shiftMonth`, `monthDateRange`) ada di `lib/utils/month.ts` dan dipakai bersama halaman Transaksi.

## Catatan implementasi drill-down Cashflow

- Tap baris di daftar breakdown membuka layar `reports/cashflow-detail` (params: type, groupBy, groupKey, label, month); tap irisan donut hanya menyorot dan menampilkan tooltip, tidak navigasi. `groupKey` kosong = bucket "Tanpa Grup"/"Tanpa Kategori".
- Layar detail meniru dialog desktop: total (ikut filter anak), filter anak, grafik harian, daftar transaksi dikelompokkan per tanggal. Query dan filter dasar sama dengan breakdown (`is_cash_neutral = 0`, tanpa dana pihak ketiga).
- "Anak" = akun dalam grup akun, atau kategori anak dalam kategori induk, dihitung dari seluruh transaksi grup (tidak ikut berubah saat satu anak dipilih). Transaksi yang langsung memakai kategori induk hanya masuk "Semua", seperti di desktop.
- Navigator bulan ada di header layar detail; pindah bulan membatalkan anak yang dipilih.
- Grafik harian digambar sendiri dengan `react-native-svg` (`detail/daily-chart.tsx`, geometri di `shared/line-chart-geometry.ts`) supaya mirip Recharts: kurva monotone, grid putus-putus, garis tergambar dari kiri ke kanan, tap titik menampilkan tooltip tanggal + total hari itu. Label sumbu-X disaring maksimal 5.
- Efek "tergambar" pada garis memakai `strokeDasharray`/`strokeDashoffset` dan titik muncul saat garis sampai ke sana. Versi pertama memakai `ClipPath` dengan lebar teranimasi, dan garis serta titik tidak tampil di Android (dugaan: `Defs`/`ClipPath` tidak ikut ter-update saat props berubah); jangan dipakai lagi untuk animasi. Lebar chart diukur lewat `onLayout`, bukan dari `Dimensions`.
- Tooltip pie dan grafik garis memakai komponen bersama `shared/chart-tooltip.tsx`.

## Catatan implementasi Periode Kategori

- Daftar periode memakai `useCategoryPeriods` yang sudah ada di mobile (halaman Kategori › Periode). Desktop memulai tanpa periode terpilih; mobile langsung memilih periode pertama (yang sedang berjalan diurutkan paling atas).
- Satu query transaksi (`use-category-period-transactions.ts`) menjadi sumber ringkasan, pie, tren, dan daftar; desktop memakai query SUM terpisah untuk ringkasan, tapi filter dan rentangnya sama (income/expense, bukan netral kas, bukan dana pihak ketiga, tanggal di antara `start_date` dan `end_date`, kategori termasuk periode), jadi hasilnya identik.
- Pie hanya dua irisan (Pemasukan, Pengeluaran) dengan warna tetap hijau dan merah; irisan bernilai 0 dibuang seperti desktop.
- Grafik tren dua garis memakai `LineSeriesChart` generik (`shared/line-series-chart.tsx`) yang kini juga dipakai grafik harian drill-down Cashflow. Perubahan perilaku di grafik harian: sentuh atau seret memilih titik terdekat (bukan harus mengenai titiknya), dan pilihan tetap sampai sentuhan berikutnya.
- Daftar transaksi dirender bertahap (50 per halaman, tombol "Tampilkan lebih banyak") karena berada di dalam ScrollView halaman Laporan; desktop memakai area gulir setinggi tetap tanpa paginasi.
- `TabSwitcher` kini bisa digeser ke samping karena empat tab Laporan tidak muat dalam satu baris.

## Catatan implementasi Tren Keuangan

- Query disalin dari desktop (`use-balance-trend.ts`): saldo awal sebelum `from` + perubahan bersih per titik waktu (UNION ALL transaksi langsung dan transfer masuk), saldo berjalan dihitung di JS. SQL dibangun di `balance-trend-query.ts` dan diuji bahwa jumlah placeholder sama dengan params, karena urutan params di dua SELECT mudah keliru.
- Filter akun (tipe, grup, akun) memakai `FilterPanel` mobile yang sama dengan halaman Transaksi, nilai array dengan operator `eq`; bawaannya hanya tipe Kas seperti desktop. Akun nonaktif dikecualikan kecuali dipilih eksplisit.
- Rentang tanggal di desktop adalah pemilih bebas (bawaan 1 bulan terakhir); di mobile preset 1 Bln, 3 Bln, 6 Bln, dan 1 Thn yang selalu berakhir hari ini. Pemilih rentang bebas belum dibuat.
- Grafik area digambar sendiri dengan `react-native-svg` (`balance-trend-chart.tsx`) dengan kurva monotone, gradien, dan sumbu yang selalu memuat 0 (saldo bisa negatif). Sentuh atau seret untuk melihat saldo titik terdekat.
- Granularitas "Mingguan" memakai `%Y-%W` seperti desktop (bukan minggu ISO), jadi nomor minggunya bisa berbeda dari kalender ISO.
- `SegmentedControl` dipakai bersama Cashflow dan Tren Keuangan (`components/segmented-control.tsx`).

## Catatan implementasi Per Tipe Akun

- Rumus saldo dan filter akun aktif disalin dari desktop (`use-balances-by-account-type.ts`) dan sama dengan rumus saldo di `use-accounts.ts` mobile. Akun nonaktif tidak dihitung.
- Tab ini tidak terikat bulan (saldo saat ini), jadi navigator bulan di header hanya tampil di tab Cashflow.
- Donut tidak bisa menggambar nilai negatif (mis. saldo utang), jadi pie hanya memuat tipe bertotal positif. Kartu tiap tipe tetap menampilkan total penuh, dan persentase dihitung terhadap jumlah semua tipe (termasuk negatif) seperti di desktop.
- Pie chart, helper data, dan palet dibagi dengan Cashflow di `features/reports/shared/`. `TabSwitcher` jadi komponen umum di `components/tab-switcher.tsx`, dipakai halaman Transaksi dan Laporan.

## Catatan teknis

- `react-native-chart-kit` adalah keputusan permanen sebelumnya dan jangan diganti library chart lain, tapi untuk Laporan pie/donut dan grafik garis digambar langsung dengan `react-native-svg` (sudah dependency langsung) karena butuh animasi dan interaksi seperti Recharts. Chart baru berikutnya (mis. Tren Keuangan) sebaiknya ikut pola ini, bukan library baru.
- Akun investasi dan dana pihak ketiga punya konsep saldo sendiri — pegang `docs/concept/konsep-investasi.md` saat menghitung saldo/cashflow yang menyentuh keduanya.

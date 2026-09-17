# Fitur Budget: Belum Ada Padanan dari Money Manager

## Latar belakang

Saat audit tabel Money Manager (`internal/backups/MMAuto[GF260916](16-09-26-043837).mmbak`)
di luar `INOUTCOME`/`ASSETS`, ditemukan tabel `BUDGET` dan `BUDGET_AMOUNT`
punya data nyata yang terpakai — bukan fitur kosong seperti
`FAVTRANSACTION` (0 baris) atau `TAG`/`TX_TAG` (dibuat tapi tidak pernah
dipasang ke transaksi). Aplikasi ini (`financial-app`) tidak punya tabel
atau fitur budget sama sekali saat ini.

## Data yang ditemukan

`BUDGET` — 8 baris (7 aktif, 1 `IS_DEL=1`):
- `targetUid` → mengarah ke `ctgUid` (kategori) untuk budget per kategori,
  atau kosong dengan `IS_TOTAL=1` untuk budget total keseluruhan.
- `DO_TYPE` — semua baris bernilai `1` (kemungkinan expense budget, belum
  dikonfirmasi lebih jauh apakah Money Manager juga punya income budget).
- `PERIOD_TYPE` — semua baris bernilai `6` (kemungkinan kode untuk
  "bulanan", belum dikonfirmasi mapping angka→arti sebenarnya).

`BUDGET_AMOUNT` — 14 baris, terhubung ke `BUDGET` lewat `budgetUid`
(format `"{targetUid}_1_0_{IS_TOTAL}_{PERIOD_TYPE}"`, mis.
`"aaa8dad9-...razb6_1_0_0_6"`):
- `AMOUNT` — nominal budget (real/rupiah).
- `BUDGET_PERIOD` — `0` untuk nominal default/recurring, atau `YYYYMM`
  (mis. `202412`, `202411`) untuk override nominal di bulan spesifik.
  Contoh: kategori dengan `budgetUid` `"aaa8dad9-..."` punya default
  Rp500.000/bulan, tapi Desember 2024 di-override jadi tetap 500rb,
  November 2024 di-override jadi Rp300.000.

## Kemungkinan bentuk fitur (belum diputuskan sama sekali)

Ini catatan temuan data, BUKAN rencana desain — kalau fitur ini mau
dibangun nanti, pertimbangan awal yang perlu digali:
- Budget per kategori vs budget total — Money Manager mendukung keduanya
  sekaligus (`IS_TOTAL` flag).
- Budget per bulan dengan kemungkinan override nominal per bulan
  tertentu (bukan cuma satu angka tetap berlaku selamanya).
- Alur bandingnya ke pengeluaran aktual — perlu agregasi transaksi per
  kategori per bulan (kemungkinan bisa reuse pola dari
  `reports/use-category-breakdown.ts` atau `use-monthly-summary.ts` yang
  sudah ada).
- UI: dashboard baru? Card di halaman existing (dashboard/reports)?
  Notifikasi kalau budget terlampaui?

## Catatan

Ini FITUR BARU (bukan bug/kehilangan data dari import — data budget
Money Manager memang tidak pernah diimpor karena `import_money_manager`
hanya menangani `INOUTCOME`/`ASSETS`/`ASSETGROUP`/`ZCATEGORY`). Dicatat
sebagai referensi kalau suatu saat fitur budgeting ingin dibangun, supaya
bentuk data historis dari Money Manager tidak perlu digali ulang dari
awal. Prioritas belum ditentukan — tidak ada urgensi mendesak.

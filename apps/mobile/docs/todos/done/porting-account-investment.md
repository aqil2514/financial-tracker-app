
# Porting Akun Tipe Investasi (Desktop → Mobile) — SELESAI

Dokumen anak dari [porting-account.md](porting-account.md) — fokus khusus tipe `investment`. Baca induknya dulu untuk konteks kenapa porting akun dipecah per tipe, dan baca [porting-account-cash.md](porting-account-cash.md) serta [porting-account-debt.md](porting-account-debt.md) sebagai referensi pola yang sudah terbukti (CRUD akun, saldo on-the-fly, picker, guard edit/delete, pemisahan logic ke `shared/<domain>/` — tipe `investment` WARIS semua itu, dokumen ini cuma menambahkan apa yang KHUSUS untuk `investment`).

**Wajib baca sebelum implementasi**: [konsep-tipe-akun.md](../../../../../docs/concept/konsep-tipe-akun.md) dan [konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md). Aturan krusial yang tidak boleh terlewat: penjualan berstatus `pending` TIDAK BOLEH membuat transaksi apa pun sampai `settled`.

## Status & TODO saat ini (ringkas)

**Porting akun tipe investasi SELESAI.** Tahap A (pembelian, nilai pasar, direct purchase, layar Ringkasan/Detail) dan Tahap B (penjualan, settle, hapus pending, write-off) sudah dikerjakan dan lolos test SQLite asli; semua alur kecuali checkbox "Semua unit" dan hapus transaksi write-off sudah dicoba di device. Tidak ada item terbuka di checklist; yang sengaja ditunda di luar dokumen ini: pie distribusi dan "Per Jenis Instrumen" (butuh sistem label dan chart), serta kolom sync. Bagian riset di bawah adalah hasil membaca konsep dan kode desktop (`apps/desktop/src/shared/investments/`, `apps/desktop/docs/tables/investment.md`) dan dipertahankan apa adanya sebagai referensi; keputusan scope yang tadinya rekomendasi sudah diambil — lihat catatan di bagian Keputusan Terbuka.

- [x] Putuskan scope per tahap — dua tahap (A pembelian, B penjualan + write-off), lihat catatan di bagian Keputusan Terbuka.
- [x] Layar Investasi: `app/investments/index.tsx` (statistik gabungan + daftar akun, satu layar tanpa tab) dan `app/investments/[id]/index.tsx` (detail: statistik P/L, breakdown pending/settled, riwayat pembelian dan penjualan), entri dari `more.tsx`. Sudah membaca data asli lewat `shared/investments/investment-queries.ts` (`getInvestmentAccounts`, `getInvestmentDetail`) + hook `useInvestmentAccounts`/`useInvestmentDetail` (refetch saat layar fokus). Pie distribusi dan "Per Jenis Instrumen" ditunda; badge label dicabut karena mobile belum punya sistem label.
- [x] Infrastruktur test: `lib/database/testing/sqlite-test-db.ts` menjalankan SELURUH migrasi mobile di SQLite asli (`node:sqlite`, in-memory) berbentuk `SQLiteDatabase`, supaya SQL dan skema ikut teruji (dipakai test query detail, holding math, dan pencatatan pembelian termasuk rollback). Butuh Node yang punya `node:sqlite`.
- [x] Tombol aksi di detail: Catat Pembelian (`purchase.tsx`), Jual (`sell.tsx`), Write-off (`write-off.tsx`), Settle (`settle-sale.tsx`), dan Hapus penjualan pending sudah jadi. Form Jual dan Write-off punya checkbox "Semua unit" (`sell-all-checkbox.tsx`) yang mengisi sisa unit dan mengunci kolomnya.
- [x] Skema database mobile: tabel `investment_accounts`, `investment_purchases`, `investment_sales`. Migrasi `0009_investments.ts`, didaftarkan di `migrations/index.ts`. Dokumentasi tabel: [investment.md](../../tables/investment.md).
- [x] `classifyAccountPair` mobile punya `cash-investment` dan `investment-cash` (`shared/debts/classify-account-pair.ts`, dengan test). `applyDebtTransaction` diberi guard no-op untuk pasangan investasi — tanpa itu pasangan baru jatuh ke cabang debt→kas.
- [x] `investment-holding-math` (`getAverageCostPerUnit`, `getRemainingUnit`) dalam SATU tempat (`shared/investments/investment-holding-math.ts`), dengan test di SQLite asli. Average Cost di detail sekarang memakai rumus ini (pembelian settled saja), bukan lagi `balance / total unit`. `getRemainingUnit` dipakai logic jual/write-off (cek oversell) dan form Jual/Write-off (sisa unit, checkbox "Semua unit").
- [x] Field akun investasi di `AccountForm` mobile: toggle tipe "Investasi", `unit_label` (wajib) + `current_market_value`, upsert ke `investment_accounts` lewat `features/accounts/upsert-investment-account.ts` (`updated_at` cuma maju kalau nilainya berubah). Dipakai di `app/accounts/new.tsx` dan `app/accounts/[id]/edit.tsx`. Tipe akun terkunci permanen saat edit (toggle disembunyikan). Balance Correction diblokir dengan pesan penolakan untuk akun investasi.
- [x] Guard di picker akun form transaksi dijadikan PERMANEN (keputusan 2026-11-03): beli, jual, dan write-off investasi hanya lewat layar khusus Investasi, jadi akun investasi disembunyikan dari picker akun (`account-picker-sheet.tsx`, dua query `account_type != 'investment'`) dan opsi tipe Investasi disembunyikan di create-inline picker (prop `hideInvestmentType` di `AccountForm`). Tanpa guard ini transaksi ke akun investasi tersimpan tanpa baris `investment_purchases`/`investment_sales`, dan transfer melempar `UnsupportedAccountPairError` setelah transaksinya sudah di-insert.
- [x] Guard "tipe akun terkunci" (`isAccountInUse`) TIDAK perlu diperluas ke `investment_purchases`/`investment_sales`: mobile tidak punya `isAccountInUse`, tipe akun terkunci permanen di layar edit (`hideAccountTypeToggle`, `app/accounts/[id]/edit.tsx`). Baru relevan kalau aturan kunci dilonggarkan; saat itu buat `isAccountInUse` di mobile yang mencakup transaksi, `debts`, `debt_payments`, `investment_purchases`, dan `investment_sales` (desktop baru mengecek transaksi dan utang).
- [x] Tahap A — pembelian: create (`applyInvestmentTransaction`, `recordInvestmentPurchase` atomik, layar Catat Pembelian), delete (`detachInvestmentPurchaseForDeletedTransaction`, dipanggil dari hapus transaksi — tanpa ini FK `SET NULL` meninggalkan baris yatim yang unitnya masih ikut average cost), edit lewat form transaksi utama (`applyInvestmentTransactionEdit`: sinkron tanggal/akun tujuan, unit-harga-status tidak disentuh, dipanggil SEBELUM menulis transaksi), dan edit langsung baris pembelian (`updateInvestmentPurchase`, layar `app/investments/[id]/edit-purchase.tsx` dari ketukan baris riwayat: unit, harga per unit/total, status Pending→Settled). Guard `InvestmentPurchaseEditBlockedError` (sisa unit tidak boleh negatif) berlaku di kedua jalur edit. Guard yang sama untuk DELETE sudah ada sejak Tahap B (`detachInvestmentPurchaseForDeletedTransaction` melempar `InvestmentPurchaseEditBlockedError` dengan pesan khusus hapus), beda dari desktop yang tidak memblok.
- [x] Tahap A — Update Nilai Pasar (tanpa transaksi) + Unrealized P/L: bottom sheet `update-market-value-sheet.tsx` dari ikon edit di detail, `shared/investments/update-market-value.ts` (`updated_at` selalu maju, beda dari form akun yang hanya maju kalau nilainya berubah).
- [x] Tahap A — direct purchase (unit masuk tanpa kas, termasuk saldo/unit awal sebelum pakai app): pilihan "Tanpa kas" di layar Catat Pembelian — transaksi `income` di akun investasi + baris pembelian `settled`, harga per unit wajib. Beda dari desktop yang memindahkannya ke form transaksi utama.
- [x] Tahap A — halaman Ringkasan dan Detail investasi (riwayat pembelian, breakdown pending/settled, average cost) — lihat item Layar Investasi di atas.
- [x] Tahap B1 — penjualan: `shared/investments/investment-sale.ts` (`recordInvestmentSale` atomik pending/settled dengan cek oversell dan dua leg, `settleInvestmentSale`, `deletePendingInvestmentSale`, `detachInvestmentSaleForDeletedTransaction`, `getTransactionInvestmentSale`) + test SQLite asli (`investment-sale.test.ts`). Keputusan user: Jual = layar penuh khusus (`app/investments/[id]/sell.tsx`), TIDAK lewat form transaksi utama (picker akun investasi disembunyikan permanen); Settle = layar `settle-sale.tsx` dengan pilih akun kas; hapus pembelian yang unitnya sudah terjual DIBLOK (`InvestmentPurchaseEditBlockedError`, beda dari desktop). Kedua leg penjualan satu kesatuan: edit lewat form transaksi umum ditolak dengan pesan, hapus salah satu leg menghapus penjualan + leg pasangannya. Jual pending/settled, settle, hapus pending, hapus transaksi jual, blok hapus pembelian, dan oversell sudah dicoba di device (2026-11-03).
- [x] Tahap B2 — write-off unit: `recordInvestmentWriteOff` di `investment-sale.ts` (`price_per_unit = 0`, selalu settled, satu transaksi `expense` di akun investasi sebesar `average_cost × unit`, tanpa leg kas, realized_pl = −kerugian) + layar `write-off.tsx` (unit, tanggal, catatan opsional; kerugian dihitung otomatis). Hapus transaksinya lewat `detachInvestmentSaleForDeletedTransaction`, edit lewat form umum diblok. Test SQLite asli lulus; write-off sudah dicoba di device (modal turun sebesar average cost × unit, badge Write-off), hapus transaksi write-off dan checkbox "Semua unit" BELUM dicoba.
- [x] Balance Correction akun investasi: DITUTUP tanpa diport (keputusan 2026-11-03), tetap diblokir dengan pesan yang mengarahkan ke Catat Pembelian "Tanpa kas" (unit kurang) dan Write-off (unit berlebih). Alasan: kebutuhannya sudah tercakup dua alat itu, dan cabang "turun" di desktop (`applyInvestmentBalanceCorrection`) mencatat `expense` sebesar harga × unit padahal aturan jual mengurangi saldo sebesar average cost × unit. Kalau suatu saat dibutuhkan: layar kecil "Koreksi Sisa Unit" yang menghitung selisih lalu memanggil `recordInvestmentPurchase` (direct) atau `recordInvestmentWriteOff`, bukan logic baru.
- **DI LUAR CAKUPAN — Balance Correction unit** (`applyInvestmentBalanceCorrection`): ditutup, lihat item di atas.
- **DI LUAR CAKUPAN — harga pasar otomatis (API)**: `current_market_value` murni manual, sama seperti desktop.

## Riset: implementasi investasi di desktop

### Skema final

Tiga tabel. Referensi lengkap: `apps/desktop/docs/tables/investment.md`, migrasi desktop `0035`→`0043`.

```sql
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);

CREATE TABLE investment_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    average_cost_per_unit REAL,
    realized_pl REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
```

Skema di atas = skema final desktop **minus** `deleted_at`, `sync_source`, dan `updated_at` pada `investment_purchases`/`investment_sales`, mengikuti keputusan yang sama dengan cash dan debt (kolom sync ditunda sampai semua tipe akun selesai). `investment_accounts.updated_at` TETAP dipertahankan karena dipakai fitur bisnis (indikator staleness nilai pasar), bukan cuma sync. Trigger `trg_*_updated_at` desktop tidak ikut, karena kolomnya tidak ada. Semua `id` bertipe `TEXT` (UUID), sama seperti tabel mobile yang sudah ada.

Catatan kunci:
- Modal (cost basis) TIDAK disimpan sebagai kolom — tetap `accounts.balance`, dihitung on-the-fly dari transaksi seperti tipe lain. Total unit juga TIDAK disimpan, selalu dihitung dari `investment_purchases`/`investment_sales`.
- `investment_purchases.unit`/`price_per_unit` NULLABLE (order pending belum tentu tahu unit final), `investment_sales.unit`/`price_per_unit` NOT NULL.
- `average_cost_per_unit` dan `realized_pl` NULL selama penjualan `pending`, baru ditulis permanen (snapshot, tidak dihitung ulang) saat `settled`.
- Pembeda lot direct (hibah/bonus/saldo awal) vs beli riil di-derive lewat JOIN `investment_purchases.transaction_id` → `transactions.type` (`income` = direct, `transfer` = beli riil). TIDAK ada kolom `source`.
- Pembeda write-off vs jual biasa: `investment_sales.price_per_unit = 0` (BUKAN `adjustment_transaction_id IS NULL` saja — itu juga bisa true untuk jual biasa dengan `realized_pl == 0`).

### Dua rumus unit — jangan dicampur

| Rumus | Dipakai untuk | Isi |
|---|---|---|
| `total_unit` | Unrealized P/L, tampilan detail | pembelian `pending` + `settled` |
| `getRemainingUnit` | validasi oversell, average cost | `SUM(unit, purchases settled) − SUM(unit, sales pending+settled)` |

`getAverageCostPerUnit` = `SUM(unit × price_per_unit) / SUM(unit)` atas pembelian `settled` saja. Di desktop kedua fungsi ada di satu file (`investment-holding-math.ts`, 59 baris) dan dipakai ulang oleh logic jual, tampilan form jual, dan nominal leg transfer — **wajib dibuat satu tempat di mobile juga**, alasan yang sama dengan fragment `remaining` di debt.

### Pembelian (`applyInvestmentTransaction`)

Referensi: `apps/desktop/src/shared/investments/apply-investment-transaction/` (`create.ts`, `edit.ts`, `delete.ts`, `README.md`).

- Hanya aktif untuk `type === 'transfer'` dengan pasangan akun `cash-investment`. Membuat satu baris `investment_purchases` (default `pending`, bisa langsung `settled`). Unit/harga manual dan TIDAK divalidasi terhadap nominal transfer.
- **Edit** (`applyInvestmentTransactionEdit`): kalau belum ada baris lama → perlakukan sebagai create. Kalau baris lama `settled`, hitung sisa unit setelah edit; negatif → tolak dengan `InvestmentPurchaseEditBlockedError` (penjualan yang sudah terjadi menyimpan snapshot average cost, jadi mengurangi unit pembelian yang sudah "terpakai" merusaknya secara retroaktif). Untuk `type !== 'transfer'` (transaksi direct yang diedit) → UPDATE in-place, BUKAN delete+recreate. Untuk `type === 'transfer'` → delete lalu create ulang.
- **Fallback ke nilai lama**: kalau `unit`/`price_per_unit` dari input `null` pada cabang non-transfer, pakai nilai baris lama. Di desktop ini dibutuhkan karena field-nya tidak dirender untuk income/expense dan query async bisa belum resolve saat submit. Cek apakah race yang sama relevan di mobile (hook-nya beda), jangan diasumsikan otomatis.
- **Delete** (`detachInvestmentPurchaseForDeletedTransaction`): hard-delete baris `investment_purchases` — beda dari `debts`, tidak ada baris anak dan bukan tumpuan `accounts.balance`.
- Dua bug dogfooding desktop 2026-10-08 (baris turunan hilang saat transaksi direct diedit; `unit` tertimpa `null`) sudah didokumentasikan di konsep — regresi test-nya perlu diport sejak awal, bukan menunggu ketemu lagi.

### Penjualan (`applySellInvestmentTransaction`)

Referensi: `apps/desktop/src/shared/investments/apply-sell-investment-transaction.ts` (459 baris, test 852 baris).

- **Average cost, bukan FIFO.** Satu angka rata-rata dipakai untuk semua unit yang dijual.
- **Efek ke saldo bukan nominal uang yang diterima.** Saldo akun investasi berkurang `average_cost × unit`. Karena satu baris transfer hanya punya satu `amount`, dibuat DUA transaksi: leg transfer utama (`average_cost × unit`, `transaction_id`) dan leg penyesuaian `income`/`expense` di akun kas sebesar `realized_pl` (`adjustment_transaction_id`, NULL kalau `realized_pl == 0`). Konsekuensi yang sudah diterima di desktop: Realized P/L ikut masuk laporan cashflow biasa.
- **`pending`**: hanya baris `investment_sales` yang dibuat. TIDAK ada baris `transactions`, `average_cost_per_unit`/`realized_pl` NULL, unit tetap berkurang optimis. Oversell dicek sejak pending.
- **`settled`**: average cost dihitung saat itu, `realized_pl` disimpan permanen, kedua transaksi dibuat.
- **Aksi Settle** (`settleInvestmentSale`) meminta user memilih akun kas tujuan, karena `investment_sales` tidak menyimpan akun kas selama pending.
- **Form transaksi utama hanya mendukung jual `settled` langsung** (form itu selalu insert satu baris `transactions`). Status `pending` hanya lewat dialog Jual khusus.
- Fungsi lain di file yang sama: `applySellInvestmentTransactionEdit`, `detachInvestmentSaleForDeletedTransaction`, `deletePendingInvestmentSale`, error `InsufficientInvestmentUnitsError`.

### Write-off unit (`applyWriteOffInvestmentTransaction`)

Referensi: `apps/desktop/src/shared/investments/apply-write-off-investment-transaction.ts` (198 baris).

- Unit hilang tanpa kas masuk (hibah keluar, delisting). Baris `investment_sales` baru dengan `price_per_unit = 0`, `status` selalu `settled`, `adjustment_transaction_id = NULL`.
- Satu transaksi `expense` langsung di akun investasi itu sendiri sebesar `average_cost × unit` (dihitung otomatis, bukan input user). `realized_pl = -average_cost × unit`.
- Punya versi edit (`applyWriteOffInvestmentTransactionEdit`) dan deteksi (`getTransactionWriteOff`) yang UPDATE in-place.

### Direct purchase (`record_mode: 'direct'`)

Unit masuk tanpa transfer kas: hibah, bonus saham, right issue, airdrop, dan **pencatatan saldo/unit awal sebelum pakai app**. Membuat transaksi `income` di akun investasi itu sendiri, lalu insert `investment_purchases` langsung (TIDAK lewat `applyInvestmentTransaction`). `price_per_unit` WAJIB diisi (supaya tidak mengencerkan average cost), `status` dipaksa `settled`. Pola yang sama dengan `createDirectDebt`. Ini juga satu-satunya cara mencatat unit yang sudah dipegang sebelum memakai app, jadi bernilai tinggi untuk pemakaian nyata.

### Update nilai pasar

Update `current_market_value` TIDAK membuat transaksi dan TIDAK mengubah `accounts.balance`. Unrealized P/L = `current_market_value − accounts.balance`, nominal dan persen (berbasis posisi aktif, bukan return total historis — disengaja, lihat konsep). Agregat total kekayaan tetap menjumlah `accounts.balance`, bukan nilai pasar.

### Balance Correction investasi

Beda dari debt: desktop TIDAK melarangnya. `applyInvestmentBalanceCorrection` (132 baris) mengoreksi **unit**: user input sisa unit sebenarnya, selisihnya dibuat jadi transaksi beli (direct) atau jual. Menggantungkan diri pada direct purchase dan penjualan, jadi baru masuk akal setelah kedua hal itu ada.

## Kesiapan mobile

- `accounts.account_type` sudah mengizinkan `'investment'` (`0005_accounts.ts`) — tidak perlu migrasi untuk itu.
- (Sudah dikerjakan) Tabel investasi ada lewat migrasi `0009_investments.ts`.
- (Sudah dikerjakan) `shared/debts/classify-account-pair.ts` sekarang mengenal `cash-investment` dan `investment-cash`. Di desktop kombinasi investasi dengan debt juga belum didukung dan dilempar sebagai `UnsupportedAccountPairError`.
- Pola yang bisa dipakai ulang dari debt: struktur `shared/<domain>/` terpisah dari UI, fake db untuk unit test, `useFocusEffect` untuk list yang stale saat kembali dari form (bug dogfooding debt), guard edit/delete berbasis `role`.
- Perlu dicek saat implementasi: bagaimana `features/transactions/form/schema.ts` dan `derive-debt-fields.ts` mengatur field kondisional, supaya field unit/harga/status investasi mengikuti pola yang sama dan tidak menambah percabangan ad-hoc.

## Keputusan terbuka

Rekomendasi saya ada di tiap poin. **Hasil keputusan (2026-11-02/03)**: scope dua tahap diikuti; Jual, Write-off, dan Catat Pembelian semuanya layar penuh khusus (bukan form transaksi utama, bukan dialog); Balance Correction unit ditunda dan diblokir; switch Pending/Settled pembelian ikut dari awal lewat layar Edit Pembelian.

- **Scope tahap.** Rekomendasi: dua tahap.
  - **Tahap A** — pembelian, nilai pasar + Unrealized P/L, direct purchase, dan halaman Ringkasan/Detail. Alasan direct masuk Tahap A: tanpa itu tidak ada cara mencatat unit yang sudah dipegang sebelum pakai app, jadi fitur terasa tidak bisa dipakai.
  - **Tahap B** — penjualan (average cost, settle, oversell, dua leg) dan write-off. Ini separuh kompleksitas dan baru bisa diuji bermakna setelah Tahap A punya data.
  - Alternatif: semuanya satu putaran. Lebih lama sebelum ada sesuatu yang bisa dicoba manual.
- **Dialog khusus vs form transaksi utama.** Desktop punya dua jalur (dialog Catat Pembelian/Jual/Write-off dan form utama). Rekomendasi: form utama untuk beli dan direct, dialog khusus hanya untuk Jual `pending`, Settle, dan Update Nilai Pasar — karena form utama secara arsitektur selalu insert satu transaksi. Perlu dikonfirmasi apakah dialog pembelian terpisah masih dibutuhkan.
- **Balance Correction unit.** Rekomendasi: tunda ke setelah Tahap B, dan sementara blokir dengan pesan penolakan di `app/accounts/[id]/edit.tsx` (pola yang sama dengan debt) supaya tidak diam-diam hilang. Alternatif: ikut Tahap B kalau ternyata sering dibutuhkan.
- **Status pembelian `pending` di form transaksi utama.** Desktop awalnya selalu `pending` lalu menambah switch Pending/Settled. Rekomendasi: switch itu ikut dari awal, karena mengedit status belakangan lewat dialog edit sebelum ada dialog edit terasa janggal.

## Catatan

- Konsep di [konsep-investasi.md](../../../../../docs/concept/konsep-investasi.md) wajib dipegang setiap kali menyentuh kode investasi. Aturan yang paling mudah terlanggar: penjualan `pending` tidak boleh insert transaksi, dan `accounts.balance` tidak boleh dikurangi nominal jual.
- Klaim di dokumen konsep bahwa `apps/worker` tidak ikut sync investasi sudah usang (Worker sekarang punya modul investasi), tapi tidak relevan untuk mobile selama kolom sync ditunda.
- Logic desktop sekitar 1.100 baris dengan sekitar 2.000 baris test. Port logic inti ke mobile kemungkinan jauh lebih besar dari debt; sebaiknya test ikut diport bersamaan dengan fungsinya, bukan belakangan.


# Tabel `investment_accounts`, `investment_purchases`, `investment_sales`

Tiga tabel yang satu kesatuan domain tipe akun **Investasi**, mendampingi akun bertipe `investment` di [account.md](account.md). Satu akun investasi = satu instrumen tunggal (bukan portofolio gabungan). `investment_accounts` menyimpan detail manual level akun (satuan unit dan nilai pasar terkini); `investment_purchases` mencatat riwayat pembelian per lot; `investment_sales` mencatat riwayat penjualan/pelepasan per lot. Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) dan [konsep-investasi.md](../../../../docs/concept/konsep-investasi.md) untuk aturan bisnisnya, dan [porting-account-investment.md](../todos/done/porting-account-investment.md) untuk riset porting dari desktop.

Ketiga tabel dibuat di migrasi `0009_investments.ts`.

## SQL final

```sql
CREATE TABLE investment_accounts (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  unit_label TEXT NOT NULL,
  current_market_value REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE investment_purchases (
  id TEXT PRIMARY KEY NOT NULL,
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
  id TEXT PRIMARY KEY NOT NULL,
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
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);
```

## Kolom

### `investment_accounts`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key SEKALIGUS foreign key ke `accounts(id)` — relasi 1:1, satu baris per akun bertipe `investment`. `ON DELETE CASCADE` — akun dihapus, baris detail ini ikut terhapus. |
| `unit_label` | TEXT | ya | - | Satuan tampilan unit instrumen ini (mis. "lembar", "unit", "gram"), bebas teks, murni kosmetik untuk UI, tidak dipakai logic apa pun. |
| `current_market_value` | REAL | ya | 0 | Nilai pasar TOTAL instrumen ini saat ini — **diupdate manual oleh user**, BUKAN ditarik dari API harga dan BUKAN dihitung dari unit × harga. Update kolom ini TIDAK membuat transaksi apa pun dan TIDAK mengubah `accounts.balance`. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu terakhir `unit_label`/`current_market_value` berubah, dipakai sebagai indikator staleness nilai pasar ("diupdate X hari lalu"). Nilainya UTC (SQLite `datetime('now')`). **Tidak ada trigger** — kode yang mengupdate nilai pasar wajib mengisinya sendiri. |

### `investment_purchases`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`. `ON DELETE CASCADE` — akun dihapus, riwayat pembelian ikut terhapus. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)` — transaksi yang melahirkan baris ini: `transfer` kas→investasi untuk pembelian biasa, atau `income` pada akun investasi itu sendiri untuk pembelian langsung tanpa kas (hibah, bonus saham, saldo awal). `ON DELETE SET NULL`. |
| `unit` | REAL | tidak | NULL | Jumlah unit/lot yang dibeli. Nullable karena order `pending` belum tentu tahu unit finalnya — diisi belakangan lewat edit. Baris dengan `unit` NULL tidak ikut hitungan unit/average cost. |
| `price_per_unit` | REAL | tidak | NULL | Harga beli per unit saat itu, snapshot historis. Nullable dengan alasan sama seperti `unit`. |
| `date` | TEXT | ya | - | Tanggal pembelian. |
| `status` | TEXT | ya | `pending` | `pending` atau `settled`, dibatasi `CHECK`. Pembelian `pending` tetap ikut `total_unit` untuk Unrealized P/L tapi TIDAK ikut unit yang bisa dijual (lihat Catatan). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

### `investment_sales`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`. `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)` — leg transfer utama (investasi→kas) sebesar `average_cost_per_unit × unit`, BUKAN nominal jual penuh. `ON DELETE SET NULL`. **NULL selama `status = 'pending'`** karena belum ada transaksi apa pun dibuat. Untuk write-off, berisi transaksi `expense` langsung di akun investasi itu sendiri. |
| `adjustment_transaction_id` | TEXT | tidak | NULL | FK **terpisah** ke `transactions(id)` — transaksi `income`/`expense` KEDUA di akun kas untuk selisih Realized P/L (satu baris transfer hanya punya satu `amount`, jadi leg utama dan selisih P/L tidak bisa digabung). `ON DELETE SET NULL`. NULL kalau `realized_pl` = 0, masih `pending`, atau baris write-off. |
| `unit` | REAL | ya | - | Jumlah unit yang dijual/dilepas. Tidak nullable, beda dari `investment_purchases.unit`. |
| `price_per_unit` | REAL | ya | - | Harga jual per unit saat itu. `0` khusus menandai write-off (unit hilang tanpa kas masuk). |
| `average_cost_per_unit` | REAL | tidak | NULL | Average cost per unit SAAT penjualan di-settle — snapshot permanen, tidak dihitung ulang. **NULL selama `pending`.** |
| `realized_pl` | REAL | tidak | NULL | Laba/rugi terealisasi = `(price_per_unit − average_cost_per_unit) × unit`, dihitung saat settle. **NULL selama `pending`.** Untuk write-off selalu negatif penuh. |
| `date` | TEXT | ya | - | Tanggal penjualan. |
| `status` | TEXT | ya | `pending` | `pending` atau `settled`, dibatasi `CHECK`. Write-off selalu `settled`. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- Ketiga tabel ini sengaja **tanpa** `deleted_at`/`sync_source` (infrastruktur cloud-sync desktop↔worker) dibanding skema final desktop, dan `investment_purchases`/`investment_sales` juga tanpa `updated_at` — sama seperti keputusan [account.md](account.md) dan [debt.md](debt.md), ditunda sampai semua porting lokal tipe akun selesai.
- **Modal (cost basis) tidak disimpan di sini** — modal = `accounts.balance`, dihitung on-the-fly dari transaksi seperti tipe akun lain (lihat [account.md](account.md)). Update `current_market_value` tidak mengubahnya. Agregat total kekayaan tetap menjumlah `accounts.balance`, bukan nilai pasar.
- **Total unit tidak disimpan sebagai kolom.** Ada DUA rumus yang tidak boleh dicampur, dan keduanya wajib satu sumber kebenaran (jangan diduplikasi manual): `total_unit` untuk Unrealized P/L = pembelian `pending` + `settled`; sisa unit yang bisa dijual (basis cek oversell dan average cost) = `SUM(unit, pembelian settled) − SUM(unit, penjualan pending + settled)`. Average cost = `SUM(unit × price_per_unit) / SUM(unit)` atas pembelian `settled` saja (bukan FIFO).
- **Penjualan `pending` tidak boleh membuat transaksi apa pun** — kas belum tersentuh meski unit sudah dikurangi dari sisa unit secara optimis. Transaksi (`transaction_id` dan `adjustment_transaction_id`) baru dibuat saat Settle, yang meminta user memilih akun kas tujuan.
- **Tidak ada kolom `source`.** Pembelian langsung tanpa kas (`transactions.type = 'income'`) dibedakan dari pembelian biasa (`'transfer'`) lewat JOIN ke `transactions`. Write-off dibedakan dari jual biasa lewat `price_per_unit = 0` (bukan `adjustment_transaction_id IS NULL` saja, karena jual biasa dengan `realized_pl` 0 juga bisa NULL di sana).
- `investment_purchases.account_id` dan `investment_sales.account_id` memakai `ON DELETE CASCADE`, beda dari `debts.account_id` yang `SET NULL` — mengikuti skema desktop.
- Lihat juga [account.md](account.md) dan [transaction.md](transaction.md) untuk tabel yang berelasi langsung ke tabel-tabel ini.

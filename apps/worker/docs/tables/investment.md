# Tabel `investment_accounts`, `investment_purchases`, `investment_sales`

Tiga tabel domain investasi, di-sync dari desktop ke D1 lewat Worker — peran tabel-tabel ini di worker murni sebagai **target sinkronisasi cloud** untuk tipe akun Investasi (`accounts.account_type = 'investment'`). `investment_accounts` tabel ekstensi 1:1 untuk akun investasi, `investment_purchases` riwayat pembelian per lot, `investment_sales` riwayat penjualan/penarikan sebagian. Lihat [konsep-investasi.md](../../../../docs/concept/konsep-investasi.md) untuk model bisnis lengkapnya (average cost, Realized/Unrealized P/L, settlement `pending`→`settled`, `record_mode: direct`, write-off) — dokumen itu menjelaskan sudut pandang desktop, bukan khusus worker. Ketiga tabel dibuat sekaligus di `0002_account_type_investment.sql`, direplikasi dari skema final desktop (migrasi 0035-0041 desktop). Skema di bawah diambil langsung dari introspeksi `sqlite_master` D1 production (bukan rekonstruksi migrasi), dibandingkan terhadap [investment.md desktop](../../../desktop/docs/tables/investment.md) sebagai referensi sumbernya.

## `investment_accounts`

Tabel ekstensi 1:1 untuk `accounts` bertipe `investment`.

### SQL final

```sql
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key sekaligus FK ke `accounts(id)`, `ON DELETE CASCADE` — akun induk dihapus, baris detail ini ikut terhapus. |
| `unit_label` | TEXT | ya | - | Satuan tampilan unit instrumen ini (mis. "lembar", "unit", "gram") — murni kosmetik untuk UI. |
| `current_market_value` | REAL | ya | 0 | Nilai pasar TOTAL instrumen ini — diupdate manual, bukan otomatis dari API harga pasar, bukan hasil hitung unit × harga. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 — wajib dikirim eksplisit oleh pemanggil (kode sync Worker/MCP). |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah. **Harus diisi manual oleh kode TypeScript Worker** tiap `UPDATE` — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK` — asal perubahan terakhir untuk resolusi sync. |

**Perbedaan dari desktop**: versi desktop `investment_accounts` punya `updated_at TEXT NOT NULL DEFAULT (datetime('now'))` (dipakai ganda sebagai indikator staleness nilai pasar DAN timestamp sync) dan tidak punya `created_at` sama sekali. Versi D1 justru kebalikannya: `created_at NOT NULL` tanpa default, `updated_at` nullable tanpa default — pola kolom sync standar worker, konsisten dengan `investment_purchases`/`investment_sales` di bawah, bukan mengikuti pola khusus desktop.

## `investment_purchases`

Riwayat pembelian per lot. Lahir otomatis dari transaksi transfer kas → akun investment, atau langsung lewat `record_mode: 'direct'` (hibah/bonus/saldo awal, lihat konsep-investasi.md).

### SQL final

```sql
CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi transfer yang melahirkan baris ini, NULL untuk baris `record_mode: 'direct'` atau kalau transaksi asalnya dihapus. |
| `unit` | REAL | tidak | NULL | Jumlah unit/lot yang dibeli. Nullable karena order `pending` belum tentu tahu unit pastinya sampai settlement. |
| `price_per_unit` | REAL | tidak | NULL | Harga beli per unit saat itu, snapshot historis. Nullable dengan alasan sama seperti `unit`. |
| `date` | TEXT | ya | - | Tanggal pembelian. |
| `status` | TEXT | ya | `pending` | `pending` atau `settled`, dibatasi `CHECK`. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 — wajib diisi eksplisit oleh pemanggil. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah. **Harus diisi manual oleh kode TypeScript Worker** tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK`. |

## `investment_sales`

Riwayat penjualan/penarikan sebagian per lot, kebalikan arah dari `investment_purchases`. `unit`/`price_per_unit` wajib diisi (tidak nullable), beda dari pembelian.

### SQL final

```sql
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
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi transfer utama (leg kas sebesar `average_cost_per_unit × unit`). NULL selama `status = 'pending'` (belum ada transaksi apa pun) atau untuk baris write-off. |
| `adjustment_transaction_id` | TEXT | tidak | NULL | FK terpisah ke `transactions(id)`, `ON DELETE SET NULL` — transaksi kedua di akun kas untuk selisih Realized P/L. NULL kalau `realized_pl` == 0 atau baris write-off. |
| `unit` | REAL | ya | - | Jumlah unit yang dijual/dilepas. Tidak nullable. |
| `price_per_unit` | REAL | ya | - | Harga jual per unit saat itu. `0` menandai baris write-off. |
| `average_cost_per_unit` | REAL | tidak | NULL | Average cost per unit saat settle — snapshot. NULL selama `status = 'pending'`. |
| `realized_pl` | REAL | tidak | NULL | Laba/rugi terealisasi, dihitung saat settle. NULL selama `status = 'pending'`. |
| `date` | TEXT | ya | - | Tanggal penjualan. |
| `status` | TEXT | ya | `pending` | `pending` atau `settled`, dibatasi `CHECK`. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 — wajib diisi eksplisit oleh pemanggil. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah. **Harus diisi manual oleh kode TypeScript Worker** tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK`. |

## Catatan

- **Tidak ada trigger apa pun di D1** (`sqlite_master` type `trigger` kosong, terverifikasi) — beda dari desktop yang punya `trg_investment_accounts_updated_at`, `trg_investment_purchases_updated_at`, `trg_investment_sales_updated_at` untuk auto-update `updated_at`. Di Worker, SETIAP kode yang melakukan `UPDATE` ke ketiga tabel ini wajib menyetel `updated_at` secara eksplisit (`datetime('now')` atau setara) — tidak ada mekanisme DB-level yang menimpanya otomatis.
- **`created_at` konsisten TANPA DEFAULT di ketiga tabel** — beda dari desktop yang semuanya punya `DEFAULT (datetime('now'))`. Kode Worker yang insert baris baru (lewat sync dari desktop atau tool MCP) wajib mengisi `created_at` sendiri. Pola ini seragam di ketiga tabel domain investasi, tidak seperti domain utang-piutang yang `debt_amount_adjustments`-nya punya pengecualian (lihat [debt.md](debt.md)).
- **`sync_source` konsisten `pc`/`mcp` dengan `CHECK`** di ketiga tabel — tidak ditemukan anomali seperti `debt_amount_adjustments.sync_source` di domain utang-piutang.
- **Modul sync investasi SUDAH aktif di worker** (`src/modules/sync/service/entities/investment-accounts.ts`, `investment-purchases.ts`, `investment-sales.ts`) dan modul bisnis investasi direplikasi penuh di `src/modules/investments/` (average cost, Realized P/L, validasi oversell) — catatan lama di beberapa bagian `konsep-investasi.md` yang menyebut "Worker tidak ikut jalur sync investment" merujuk status SEBELUM `0002_account_type_investment.sql` dan modul `investments/` dibangun, sudah tidak akurat untuk kondisi skema saat ini.
- **Total unit tidak disimpan sebagai kolom** — tetap `SUM(unit)` dari `investment_purchases`/`investment_sales` sesuai status, sama seperti desktop. `accounts.balance` dan `current_market_value` juga tidak saling menghitung otomatis di level DB — logic itu ada di kode Worker, bukan di skema.
- Lihat [account.md](account.md) untuk tabel `accounts` yang direferensikan, dan [konsep-investasi.md](../../../../docs/concept/konsep-investasi.md) untuk makna bisnis lengkap kolom-kolom di atas.


# Tabel `forex_accounts`, `forex_purchases`, `forex_sales`

Tiga tabel domain valas di D1, peran di Worker sebagai **target sinkronisasi cloud** sekaligus tempat logic tulis untuk klien tanpa jalur tulis lokal (lihat Catatan) untuk tipe akun Valas (`accounts.account_type = 'forex'`). `forex_accounts` tabel ekstensi 1:1 untuk akun valas, `forex_purchases` riwayat pembelian, `forex_sales` riwayat penjualan. Lihat [konsep-valas.md](../../../../docs/concept/konsep-valas.md) untuk model bisnisnya dan [forex.md desktop](../../../desktop/docs/tables/forex.md) untuk skema sumbernya. Ketiganya dibuat di `0011_account_type_forex.sql`, bersamaan dengan pembukaan `'forex'` di `CHECK` `accounts.account_type`. Skema di bawah diambil dari migrasi `0011` yang sudah diverifikasi pada salinan D1 lokal, **belum ter-apply ke D1 production**.

Beda dari desktop: tiap tabel punya `created_at` tanpa default (diisi aplikasi) plus `updated_at`/`deleted_at`/`sync_source`, dan penghapusan di Worker berupa soft-delete (`UPDATE deleted_at`), bukan hard `DELETE`.

## `forex_accounts`

### SQL final

```sql
CREATE TABLE forex_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    currency TEXT NOT NULL,
    current_rate REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key sekaligus FK ke `accounts(id)`, `ON DELETE CASCADE`. Relasi 1:1. |
| `country` | TEXT | ya | - | Negara asal mata uang, teks bebas. Informasi untuk tampilan. |
| `currency` | TEXT | ya | - | Kode atau satuan mata uang, teks bebas (mis. "USD"). |
| `current_rate` | REAL | ya | 0 | Kurs terkini, rupiah per 1 unit, diisi manual di klien. Mengubahnya tidak membuat transaksi dan tidak mengubah saldo akun. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat di D1, format `YYYY-MM-DD HH:mm:ss` (UTC). |
| `updated_at` | TEXT | tidak | NULL | Timestamp last-write-wins untuk sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sync. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, asal perubahan terakhir. |

## `forex_purchases`

### SQL final

```sql
CREATE TABLE forex_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    rate REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_forex_purchases_account ON forex_purchases(account_id);
CREATE INDEX idx_forex_purchases_transaction ON forex_purchases(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. Pada `POST /forex/purchases` dikirim klien dan dipakai sebagai kunci idempotensi. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL`. Transaksi transfer kas ke valas, atau income langsung ke akun valas untuk pembelian tanpa akun kas. |
| `unit` | REAL | ya | - | Jumlah mata uang asing yang dibeli. |
| `rate` | REAL | ya | - | Kurs beli per unit, snapshot historis. Nominal transaksi selalu `unit × rate`. |
| `date` | TEXT | ya | - | Tanggal pembelian. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat di D1. |
| `updated_at` | TEXT | tidak | NULL | Timestamp last-write-wins. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`. |

## `forex_sales`

### SQL final

```sql
CREATE TABLE forex_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    rate REAL NOT NULL,
    average_cost_per_unit REAL NOT NULL,
    realized_pl REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_forex_sales_account ON forex_sales(account_id);
CREATE INDEX idx_forex_sales_transaction ON forex_sales(transaction_id);
CREATE INDEX idx_forex_sales_adjustment_transaction ON forex_sales(adjustment_transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. Kunci idempotensi pada `POST /forex/sales`. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL`. Transfer valas ke kas senilai `average_cost_per_unit × unit`, bukan nominal jual penuh. |
| `adjustment_transaction_id` | TEXT | tidak | NULL | FK terpisah ke `transactions(id)`. Transaksi `income`/`expense` di akun kas untuk selisih kurs. NULL kalau `realized_pl` hampir nol. |
| `unit` | REAL | ya | - | Jumlah yang dijual. |
| `rate` | REAL | ya | - | Kurs jual yang diterima per unit. |
| `average_cost_per_unit` | REAL | ya | - | Average cost per unit atas posisi tersisa saat jual, snapshot permanen. |
| `realized_pl` | REAL | ya | - | `(rate − average_cost_per_unit) × unit`, snapshot permanen. |
| `date` | TEXT | ya | - | Tanggal penjualan. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat di D1. |
| `updated_at` | TEXT | tidak | NULL | Timestamp last-write-wins. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`. |

## Catatan

- **Dua kelompok endpoint** (`src/modules/forex/router.ts`): jalur push upsert-by-id (`/forex/accounts/push`, `/purchases/push`, `/sales/push`, dan `DELETE` untuk dua yang terakhir) dipakai klien yang punya jalur tulis lokal (desktop, mobile), serta jalur tulis `POST /forex/purchases` dan `POST /forex/sales` yang membuat transaksi plus riwayat di Worker, untuk klien tanpa jalur tulis lokal.
- **Transaksi valas dari sumber `mcp` ditolak** di `/transactions` (`validateForexTransactionAllowed`), supaya tidak jatuh jadi transfer kas tanpa riwayat unit. Transaksi dari sumber `pc` lolos karena riwayatnya di-push sendiri.
- **Average cost atas posisi tersisa**, bukan atas semua pembelian: `(SUM(unit × rate) pembelian − SUM(unit × average_cost_per_unit) penjualan) / sisa unit`, hanya baris dengan `deleted_at IS NULL`. Jangan disalin dari rumus investasi.
- **Hapus transaksi** (`deleteTransaction`) ikut soft-delete riwayat beli/jual yang menunjuk ke transaksi itu. Dua transaksi sebuah penjualan saling bergantung, jadi menghapus salah satunya menghapus pasangannya.
- **Hapus pembelian yang unitnya sudah terpakai penjualan ditolak** (`validateForexPurchaseDeletable`, `DELETE /transactions/:id` mengembalikan 422): sisa unit tidak boleh menjadi negatif, penjualannya harus dihapus lebih dulu. `DELETE /forex/purchases/push/:id` sengaja tanpa guard, ia mencerminkan penghapusan yang sudah divalidasi klien.
- Lihat [account.md](account.md) untuk tabel `accounts` dan [transaction.md](transaction.md) untuk tabel `transactions`.


# Tabel valas (`forex_accounts`, `forex_purchases`, `forex_sales`)

Tiga tabel ini satu domain erat — tipe akun **Valas** (`accounts.account_type = 'forex'`), jadi digabung satu file. Lihat [konsep-valas.md](../../../../docs/concept/konsep-valas.md) untuk model bisnis lengkapnya; dokumen ini murni referensi skema. Dibuat di migrasi `0057_forex_accounts_and_trades.sql`, setelah `0056_account_type_forex.sql` membuka `'forex'` di `CHECK` `accounts.account_type`.

Konsep inti: satu akun valas = satu mata uang. Modal (cost basis, dalam rupiah) TIDAK disimpan di sini — tetap `accounts.balance`, dihitung dari transaksi seperti tipe akun lain (lihat [account.md](account.md)). Ketiga tabel ini murni riwayat/detail tambahan di atas mekanisme transaksi itu. Strukturnya meniru [investment.md](investment.md) tanpa kolom `status`, karena beli dan jual valas langsung final.

## `forex_accounts`

Tabel ekstensi 1:1 untuk `accounts` bertipe `forex`. Menyimpan identitas mata uang dan kurs terkini yang diinput manual.

### SQL final

```sql
CREATE TABLE forex_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    currency TEXT NOT NULL,
    current_rate REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key SEKALIGUS foreign key ke `accounts(id)`, `ON DELETE CASCADE` — akun induk dihapus, baris detail ini ikut terhapus. Relasinya 1:1, satu akun valas hanya punya satu baris detail. |
| `country` | TEXT | ya | - | Nama negara asal mata uang, teks bebas (mis. "Amerika Serikat"). Murni informasi untuk UI, tidak dipakai logic apa pun. |
| `currency` | TEXT | ya | - | Kode atau satuan mata uang, teks bebas (mis. "USD"). Tidak ada daftar baku supaya mata uang apa pun bisa dicatat. |
| `current_rate` | REAL | ya | 0 | Kurs terkini: rupiah per 1 unit mata uang asing, **diinput manual oleh user**, BUKAN ditarik dari API. Nilai terkini akun = `unit × current_rate`. Update kolom ini TIDAK membuat transaksi apa pun dan TIDAK mengubah `accounts.balance`. Panduan pengisian ada di konsep-valas.md (kurs beli bank, bukan kurs yang dibayar saat membeli). |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu terakhir baris ini berubah. Dipakai ganda: indikator kurs usang di UI dan timestamp sync. Karena itu mengedit `country`/`currency` juga memperbaruinya, lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sinkronisasi cloud. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — asal baris ini untuk mekanisme sync dua-arah ke Cloudflare D1. |

## `forex_purchases`

Riwayat pembelian valas per lot. Lahir dari transaksi transfer kas → akun valas (atau jalur `direct` tanpa kas sumber, pola sama investasi). Total unit yang dipegang TIDAK disimpan sebagai kolom — selalu `SUM(unit)` dari tabel ini dikurangi `SUM(unit)` dari `forex_sales`.

### SQL final

```sql
CREATE TABLE forex_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    rate REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE` — akun dihapus, riwayat beli ikut terhapus. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi yang melahirkan baris ini. NULL kalau transaksi asalnya dihapus. Detail tabel `transactions` di [transaction.md](transaction.md). |
| `unit` | REAL | ya | - | Jumlah mata uang asing yang dibeli (mis. 100 untuk 100 USD). Tidak nullable, beda dari `investment_purchases.unit`, karena tidak ada skenario pending yang belum tahu unitnya. |
| `rate` | REAL | ya | - | Kurs beli per unit saat itu (rupiah per 1 unit), snapshot historis. Dasar hitung average cost. Tidak nullable, alasan sama dengan `unit`. |
| `date` | TEXT | ya | - | Tanggal pembelian. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah, diisi otomatis oleh trigger. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sinkronisasi cloud. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, asal baris ini untuk mekanisme sync. |

## `forex_sales`

Riwayat penjualan valas ke rupiah — kebalikan arah dari `forex_purchases`. Tidak ada status `pending`: baris selalu langsung final, jadi `average_cost_per_unit` dan `realized_pl` dihitung dan disimpan saat baris dibuat.

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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi transfer utama dari akun valas ke akun kas, senilai `average_cost_per_unit × unit` (BUKAN nominal jual penuh). NULL kalau transaksinya dihapus. |
| `adjustment_transaction_id` | TEXT | tidak | NULL | FK **terpisah** ke `transactions(id)`, `ON DELETE SET NULL` — transaksi `income`/`expense` kedua di akun kas untuk selisih kurs (Realized P/L), karena satu baris transfer cuma punya satu kolom `amount`. NULL kalau `realized_pl` sama dengan 0. |
| `unit` | REAL | ya | - | Jumlah mata uang asing yang dijual. |
| `rate` | REAL | ya | - | Kurs jual yang diterima per unit saat itu (rupiah per 1 unit). |
| `average_cost_per_unit` | REAL | ya | - | Average cost per unit SAAT penjualan, snapshot permanen, tidak dihitung ulang. Rumusnya `SUM(unit × rate) / SUM(unit)` atas `forex_purchases` akun ini. |
| `realized_pl` | REAL | ya | - | Laba/rugi kurs terealisasi `= (rate − average_cost_per_unit) × unit`, snapshot permanen. |
| `date` | TEXT | ya | - | Tanggal penjualan. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah, diisi otomatis oleh trigger. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sinkronisasi cloud. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, asal baris ini untuk mekanisme sync. |

## Catatan

- **Baru skema, belum ada kode yang memakainya.** Per migrasi ini ditulis, tipe `forex` belum dikenal kode TypeScript (`AccountType`, `classifyAccountPair`, form, laporan), jadi tabel-tabel ini belum terisi data apa pun. Rencana pengerjaan di [account-type-forex.md](../todos/plan/account-type-forex.md).
- **Average cost, bukan FIFO**, sama seperti investasi. Satu angka rata-rata dipakai untuk semua unit yang dijual. Rumus sisa unit yang bisa dijual: `SUM(unit, forex_purchases) − SUM(unit, forex_sales)`. Tidak ada filter `status` karena tidak ada pending.
- **Efek jual ke `accounts.balance` memakai average cost, bukan nominal jual**, lewat dua transaksi (`transaction_id` dan `adjustment_transaction_id`), pola sama [investment.md](investment.md) bagian Catatan.
- **`updated_at` di `forex_accounts` dipakai ganda** (indikator kurs usang dan timestamp sync), seperti `investment_accounts`. Mengedit `country`/`currency` ikut memperbaruinya. Kolom `rate_updated_at` terpisah belum ditambahkan, keputusannya belum diambil.
- Tidak ada `CHECK (unit > 0)` atau sejenisnya; validasi ada di form, konsisten dengan tabel investasi.
- Trigger `trg_forex_accounts_updated_at`, `trg_forex_purchases_updated_at`, dan `trg_forex_sales_updated_at` masing-masing menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- Laporan/agregat total kekayaan tetap menjumlah `accounts.balance` (modal rupiah), bukan nilai terkini valas.
- Kolom sync (`updated_at`/`deleted_at`/`sync_source`) sudah ada sejak awal, tapi antrean sync (`cloud_sync_queue`) dan tabel D1 di Worker belum disiapkan.
- Lihat [account.md](account.md) untuk detail tabel `accounts` dan [transaction.md](transaction.md) untuk tabel `transactions`.

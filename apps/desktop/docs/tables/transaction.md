
# Tabel `transactions`

Mencatat setiap transaksi keuangan (income, expense, transfer antar akun) — tabel inti aplikasi, dibaca/ditulis paling sering. Saldo akun dihitung dari agregasi baris-baris di tabel ini, bukan dari kolom tersimpan terpisah. Transaksi juga bisa berasal dari sinkronisasi data POS/warung terpisah (Retailku), ditandai lewat kolom `source`/`source_ref`. Lihat [konsep-transaksi.md](../../../../docs/concept/konsep-transaksi.md) untuk konsep lengkap income/expense/transfer, transaksi penutup, dan kenapa semua perubahan saldo wajib lewat tabel ini.

## SQL final

```sql
CREATE TABLE transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transfer_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    description TEXT,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    is_cash_neutral INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_contact_id ON transactions(contact_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE UNIQUE INDEX idx_transactions_source_ref
    ON transactions(source, source_ref)
    WHERE source_ref IS NOT NULL;
CREATE INDEX idx_transactions_transfer_account ON transactions(transfer_account_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `type` | TEXT | ya | - | `income`, `expense`, atau `transfer` — dibatasi `CHECK`. Transaksi penutup (koreksi saldo, write-off, pelunasan non-cash) tetap pakai salah satu dari tiga ini, tidak ada tipe terpisah. |
| `amount` | REAL | ya | - | Nominal transaksi, selalu positif — arah ditentukan `type`, bukan tanda angka. |
| `category_id` | TEXT | tidak | NULL | FK ke `categories(id)`. `ON DELETE SET NULL` — kategori dihapus, transaksi tetap ada, cuma kategorinya jadi kosong. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`. `ON DELETE SET NULL` — akun dihapus, transaksi tetap ada. Akun sumber/terkait; untuk `transfer`, ini akun asal. |
| `transfer_account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`. `ON DELETE SET NULL`. Akun tujuan, hanya relevan kalau `type = 'transfer'`. |
| `note` | TEXT | ya | - | Judul singkat transaksi (mis. "Makan siang"). |
| `date` | TEXT | ya | - | Tanggal transaksi (bukan tanggal input/`created_at`). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris ini dibuat. |
| `description` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `contact_id` | TEXT | tidak | NULL | FK ke `contacts(id)`. `ON DELETE SET NULL`. Kontak terkait transaksi — lihat Catatan untuk alur debt otomatis. |
| `source` | TEXT | ya | `manual` | `manual` atau `retailku_sync` — dibatasi `CHECK`. Menandai transaksi dibuat lewat form biasa atau hasil sinkronisasi dari Retailku (POS/warung terpisah). |
| `source_ref` | TEXT | tidak | NULL | Referensi id transaksi di sistem asal (Retailku), dipakai sync untuk mencocokkan baris saat re-sync. NULL kalau `source = 'manual'`. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. Bagian mekanisme sinkronisasi cloud. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — menandai asal perubahan terakhir untuk sinkronisasi cloud Worker/MCP. |
| `is_cash_neutral` | INTEGER | ya | 0 | Boolean (0/1), khusus transaksi Balance Correction pada akun `cash`. `0` = selisih kas fisik riil (ikut cashflow), `1` = koreksi administratif saja (exclude dari cashflow). Transaksi biasa (bukan hasil Balance Correction) selalu `0`. |

## Catatan

- Saldo akun **tidak** disimpan di tabel ini maupun di `accounts` — selalu dihitung on-the-fly dari `SUM(amount)` tabel ini per `account_id`/`transfer_account_id` dan `type`, detail rumus ada di [account.md](account.md).
- `source` + `source_ref`: transaksi bisa berasal dari sinkronisasi Retailku (sistem POS/warung terpisah dari aplikasi ini). `idx_transactions_source_ref` adalah UNIQUE partial index pada `(source, source_ref) WHERE source_ref IS NOT NULL` — mencegah baris duplikat masuk tiap kali proses re-sync jalan lagi.
- `contact_id` juga dipakai untuk alur pembuatan debt otomatis: transaksi expense/income biasa (bukan cuma form transfer debt khusus) yang diisi kontaknya bisa membentuk debt yang valid — detail alurnya tidak dijelaskan di sini, lihat [konsep-utang-piutang.md](../../../../docs/concept/konsep-utang-piutang.md).
- `category_id` dan `account_id`/`transfer_account_id` masing-masing `ON DELETE SET NULL` ke `categories`/`accounts` — menghapus kategori atau akun tidak ikut menghapus riwayat transaksinya.
- `updated_at`, `deleted_at`, `sync_source` adalah kolom pendukung soft-delete dan sinkronisasi cloud, dirujuk singkat di sini — detail mekanismenya ada di dokumen lain. Trigger `trg_transactions_updated_at` otomatis menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- Lihat juga [account.md](account.md) dan [transaction-attachment.md](transaction-attachment.md) untuk tabel yang berelasi langsung ke tabel ini.

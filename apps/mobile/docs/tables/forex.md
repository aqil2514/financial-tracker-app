# Tabel valas (`forex_accounts`, `forex_purchases`, `forex_sales`)

Tiga tabel satu domain tipe akun **Valas** (`accounts.account_type = 'forex'`), mendampingi [account.md](account.md). Satu akun valas = satu mata uang. Modal (rupiah) TIDAK disimpan di sini, tetap saldo akun yang dihitung dari transaksi. Model bisnis: [konsep-valas.md](../../../../docs/concept/konsep-valas.md). Skema mengacu ke desktop ([forex.md](../../../desktop/docs/tables/forex.md)) tanpa `deleted_at` dan `sync_source`: mobile hard delete dan selalu bersumber `pc`.

Dibuat di migrasi `0019_forex.ts`, setelah `0018_account_type_forex.ts` membuka `'forex'` di `CHECK` `accounts.account_type` (tabel `accounts` dibangun ulang dengan prosedur resmi SQLite, `foreign_keys` OFF, isi tabel anak tidak disentuh). `0019` juga memperluas `CHECK` `cloud_sync_queue` dan memasang trigger antrean.

## SQL final

```sql
CREATE TABLE forex_accounts (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  current_rate REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE forex_purchases (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  unit REAL NOT NULL,
  rate REAL NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_forex_purchases_account ON forex_purchases(account_id);
CREATE INDEX idx_forex_purchases_transaction ON forex_purchases(transaction_id);

CREATE TABLE forex_sales (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  unit REAL NOT NULL,
  rate REAL NOT NULL,
  average_cost_per_unit REAL NOT NULL,
  realized_pl REAL NOT NULL,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_forex_sales_account ON forex_sales(account_id);
CREATE INDEX idx_forex_sales_transaction ON forex_sales(transaction_id);
CREATE INDEX idx_forex_sales_adjustment_transaction ON forex_sales(adjustment_transaction_id);
```

## Kolom

Arti kolom sama persis dengan desktop, lihat [forex.md desktop](../../../desktop/docs/tables/forex.md). Ringkasnya:

| Tabel | Kolom penting |
|---|---|
| `forex_accounts` | `country`/`currency` teks bebas; `current_rate` = rupiah per 1 unit, input manual; `updated_at` dipakai ganda (indikator kurs usang dan timestamp sync). |
| `forex_purchases` | `unit` dan `rate` (kurs beli per unit saat itu), keduanya wajib; tanpa kolom status. |
| `forex_sales` | `rate` (kurs jual), `average_cost_per_unit` dan `realized_pl` snapshot permanen saat jual; `transaction_id` (transfer senilai average cost × unit) dan `adjustment_transaction_id` (income/expense selisih kurs). |

## Catatan

- Trigger: `trg_<tabel>_updated_at_ins/upd` mengisi `updated_at`; trigger antrean sync `trg_forex_purchases_queue_*` dan `trg_forex_sales_queue_*` (berkunci `id`), serta `trg_forex_accounts_queue_*` (berkunci `account_id`, hapus mengantre upsert, pola `investment_accounts`, tanpa endpoint delete).
- Average cost memakai rumus posisi tersisa seperti desktop, BUKAN rumus investasi.
- Test migrasi: `src/lib/database/migrations/forex-migration.test.ts` (isi akun dan antrean tidak berubah, FK tetap aktif, cascade, antrean).

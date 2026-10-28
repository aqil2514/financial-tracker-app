
# Tabel `transactions`

Mencatat setiap transaksi keuangan (pemasukan, pengeluaran, transfer antar akun). Ini tabel paling sering dibaca/ditulis di aplikasi — jadi akun (`account_id`), kategori (`category_id`), dan saldo semuanya dihitung dari baris-baris di tabel ini, bukan dari kolom tersimpan terpisah.

Skema di bawah adalah hasil akhir setelah migrasi `0001`, `0004`, dan `0006` (lihat `src/lib/database/migrations/`) — bukan satu migrasi tunggal. `category_id` baru punya FK sejak `0004`, dan `is_cash_neutral` baru ada sejak `0006`.

## SQL final

```sql
CREATE TABLE transactions (
  id TEXT PRIMARY KEY NOT NULL,
  note TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  account_id TEXT NOT NULL,
  transfer_account_id TEXT,
  has_attachment INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_cash_neutral INTEGER NOT NULL DEFAULT 0
);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `note` | TEXT | ya | - | Judul singkat transaksi (mis. "Makan siang"). |
| `description` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `type` | TEXT | ya | - | `income`, `expense`, atau `transfer` — dibatasi `CHECK`. |
| `amount` | REAL | ya | - | Nominal transaksi, selalu positif (arah ditentukan `type`, bukan tanda angka). |
| `date` | TEXT | ya | - | Tanggal transaksi (bukan tanggal input/`created_at`). |
| `category_id` | TEXT | tidak | NULL | FK ke `categories(id)`. `ON DELETE SET NULL` — kategori dihapus tidak ikut menghapus transaksinya. Diisi lewat `CategoryPickerSheet` (drill-down 2 level + inline-create) di form transaksi, lihat `docs/todos/done/porting-category.md`. |
| `account_id` | TEXT | ya | - | Akun sumber/terkait transaksi. **Belum** FK formal ke `accounts(id)` (beda dari `category_id`), tapi sejak `AccountPickerSheet` (lihat `docs/todos/done/porting-account-cash.md`) nilainya selalu valid UUID `accounts.id` secara praktik — bukan lagi free-text. FK formal (migrasi copy-and-rename seperti `0004`) belum ditulis. |
| `transfer_account_id` | TEXT | tidak | NULL | Akun tujuan, hanya relevan kalau `type = 'transfer'`. Sama seperti `account_id` — diisi via `AccountPickerSheet`, FK formal belum ada. |
| `has_attachment` | INTEGER | ya | 0 | Boolean (0/1) — ada/tidaknya lampiran di `transaction_attachments`. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris ini dibuat (bukan tanggal transaksi). |
| `is_cash_neutral` | INTEGER | ya | 0 | Boolean (0/1) — khusus transaksi Balance Correction akun `cash`. `0` = selisih kas fisik riil (ikut laporan cashflow), `1` = koreksi administratif saja (exclude dari cashflow). Transaksi biasa (bukan hasil Balance Correction) selalu `0`. |

## Catatan

- Saldo akun **tidak** disimpan di tabel ini atau di `accounts` — selalu dihitung on-the-fly dari `SUM(amount)` tabel ini, dikelompokkan per `account_id`/`transfer_account_id` dan `type`. Lihat bagian "Saldo" di `docs/todos/done/porting-account-cash.md` untuk rumus persisnya.
- `account_id`/`transfer_account_id` belum diberi FK formal — nilainya sudah selalu UUID `accounts.id` valid (diisi via `AccountPickerSheet`, bukan lagi teks bebas), tapi migrasi FK (pola copy-and-rename seperti `0004_transaction_category_fk.ts`) belum ditulis. Menyusul kalau dibutuhkan (mis. saat ada kebutuhan enforce integrity di level DB), bukan blocker untuk fitur apa pun saat ini.
- Lihat juga [account.md](account.md) dan [transaction-attachment.md](transaction-attachment.md) untuk tabel yang berelasi langsung ke tabel ini.

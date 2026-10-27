# Tabel `transactions`

Mirror cloud dari tabel inti `transactions` di desktop — target sinkronisasi dua arah (PC push/pull, MCP read/write) lewat `apps/worker`. Dibuat di `schema/0001_initial.sql` sebagai replika 7 tabel data user dari desktop pasca migrasi `0028_cloud_sync_columns.sql`, lalu dapat kolom `is_cash_neutral` di `schema/0008_transaction_cash_neutral_flag.sql`. Untuk konsep income/expense/transfer, transaksi penutup, dan kenapa semua perubahan saldo wajib lewat tabel ini, lihat [konsep-transaksi.md](../../../../docs/concept/konsep-transaksi.md) — dokumen itu ditulis dari sudut pandang desktop, tapi aturan datanya berlaku sama di sini karena worker cuma mirror representasi, bukan mendefinisikan ulang konsepnya.

Perannya di worker murni sebagai gudang replika untuk sinkronisasi — tidak ada logic bisnis (hitung saldo, buat debt otomatis, dsb) yang jalan di D1 lewat trigger/constraint; semua itu direplikasi di kode TypeScript worker sebelum baris ditulis.

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
    description TEXT,
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
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
| `id` | TEXT | ya | - | Primary key, UUID v7. Nilainya WAJIB sama persis dengan `id` baris terkait di SQLite lokal desktop — inilah kunci penghubung lintas device, bukan dibuat baru oleh worker. |
| `type` | TEXT | ya | - | `income`, `expense`, atau `transfer` — dibatasi `CHECK`, sama dengan desktop. |
| `amount` | REAL | ya | - | Nominal transaksi, selalu positif. |
| `category_id` | TEXT | tidak | NULL | FK ke `categories(id)`, `ON DELETE SET NULL`. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`, `ON DELETE SET NULL`. Akun sumber/terkait. |
| `transfer_account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`, `ON DELETE SET NULL`. Akun tujuan, relevan kalau `type = 'transfer'`. |
| `note` | TEXT | ya | - | Judul singkat transaksi. |
| `date` | TEXT | ya | - | Tanggal transaksi (bukan `created_at`). |
| `description` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `contact_id` | TEXT | tidak | NULL | FK ke `contacts(id)`, `ON DELETE SET NULL`. |
| `source` | TEXT | ya | `manual` | `manual` atau `retailku_sync` — dibatasi `CHECK`, direplikasi apa adanya dari desktop. |
| `source_ref` | TEXT | tidak | NULL | Referensi id transaksi di sistem asal (Retailku). NULL kalau `source = 'manual'`. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT di D1** — nilainya wajib disetel eksplisit oleh kode worker saat INSERT, berbeda dari desktop yang punya `DEFAULT (datetime('now'))`. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. Dasar algoritma LWW (last-write-wins) untuk resolusi konflik sinkronisasi PC vs MCP — lihat `src/shared/lww.ts`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — menandai asal penulis terakhir baris ini. |
| `is_cash_neutral` | INTEGER | ya | 0 | Boolean (0/1), sama makna dengan desktop: `1` = koreksi administratif akun cash yang exclude dari cashflow. |

## Catatan

- **Tidak ada trigger apa pun di D1** (terverifikasi lewat introspeksi `sqlite_master type='trigger'` pada database production — hasilnya kosong). Desktop punya trigger `trg_transactions_updated_at` yang otomatis menimpa `updated_at` tiap `UPDATE`; di worker, setiap INSERT/UPDATE terhadap tabel ini WAJIB mengisi `updated_at` secara eksplisit dari kode TypeScript (lihat `src/modules/transactions/service.ts` dan `src/modules/sync/service/entities/transactions.ts`). Ini keputusan sengaja, bukan kelalaian — logic "siapa yang menang" (LWW) butuh nilai `updated_at` dikontrol presisi oleh worker, bukan auto-generate DB.
- `created_at` juga TIDAK punya DEFAULT di D1 (beda dari desktop) — worker selalu mengisi lewat `nowText()` (`src/shared/lww.ts`) saat INSERT, konsisten dengan pola "worker selalu isi eksplisit" di atas.
- Constraint bisnis di skema D1 sengaja diminimalkan — cuma `CHECK` enum dan `UNIQUE` idempotency (`idx_transactions_source_ref`) yang dipertahankan. Semua logic bisnis lain (hitung saldo on-the-fly, pembuatan debt otomatis dari `contact_id`, dsb — lihat konsep di dokumen desktop) WAJIB direplikasi di kode worker sebelum endpoint menulis ke tabel ini, bukan dipindah jadi constraint D1.
- `id` tiga tabel ini (`transactions`, dan turunannya seperti `transaction_attachments`) WAJIB UUID v7 dari caller, bukan server-generate — nilainya harus identik dengan baris SQLite lokal desktop supaya sinkronisasi bisa mencocokkan baris lintas device.
- Lihat juga [transaction-attachment.md](transaction-attachment.md) dan [contact.md](contact.md) untuk tabel yang berelasi langsung ke tabel ini.

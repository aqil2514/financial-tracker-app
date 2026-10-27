# Tabel `debts`, `debt_payments`, `debt_accounts`, `debt_amount_adjustments`

Empat tabel yang bersama-sama merepresentasikan fitur piutang/utang: `debt_accounts` menandai sebuah akun sebagai akun Utang/Piutang dan menyimpan arahnya, `debts` adalah catatan satu piutang/utang yang "lahir" dari sebuah transaksi, `debt_payments` adalah riwayat pelunasan bertahap atas sebuah `debts`, dan `debt_amount_adjustments` adalah riwayat koreksi nominal atas sebuah `debts` di luar mekanisme pelunasan normal. Keempatnya digabung dalam satu file karena satu domain yang saling terkait erat — lihat [konsep-utang-piutang.md](../../../../docs/concept/konsep-utang-piutang.md) untuk konsep lengkapnya (receivable vs payable, status, FIFO alokasi pelunasan, aturan edit/hapus transaksi terkait) sebelum membaca penjelasan kolom di bawah.

## `debt_accounts`

Tabel ekstensi satu-ke-satu untuk `accounts` bertipe `debt` — setiap akun Utang/Piutang punya tepat satu baris di sini yang menyimpan `direction`-nya (tetap, bukan ditebak dari transaksi).

### SQL final

```sql
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable'))
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key **sekaligus** FK ke `accounts(id)`. `ON DELETE CASCADE` — akun dihapus, baris ekstensi ini ikut terhapus. Karena PK = FK, relasinya satu-ke-satu murni: satu akun `debt` punya tepat satu baris di sini, tidak lebih. |
| `direction` | TEXT | ya | - | `receivable` (akun ini khusus piutang — pihak lain berutang ke kita) atau `payable` (akun ini khusus utang — kita berutang ke pihak lain), dibatasi `CHECK`. Tidak ada pilihan netral/dua-arah — sumber kebenaran untuk `debts.type` begitu akun ini dipakai. |

## `debts`

Satu baris = satu piutang atau utang yang "lahir" dari sebuah transaksi (transfer kas ↔ akun Utang/Piutang, atau income/expense langsung di akun Utang/Piutang). Status berjalan sampai lunas atau dihapuskan.

### SQL final

```sql
CREATE TABLE debts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
    contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE UNIQUE INDEX idx_debts_source_ref
    ON debts(source, source_ref)
    WHERE source_ref IS NOT NULL;
CREATE INDEX idx_debts_status ON debts(status);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `type` | TEXT | ya | - | `receivable` atau `payable`, dibatasi `CHECK`. Selalu sejenis dengan `direction` akun Utang/Piutang yang melahirkannya (`debt_accounts.direction`) — bukan ditebak ulang dari arah transaksi. |
| `contact_id` | TEXT | tidak | NULL | FK ke `contacts(id)`. `ON DELETE SET NULL` — kontak dihapus, baris `debts` tetap ada. Ini pihak **lawan** piutang/utangnya (siapa yang berutang/dipinjami) — beda peran dari `account_id` di bawah. Wajib diisi saat piutang/utang baru lahir. |
| `amount` | REAL | ya | - | Nominal pokok piutang/utang saat lahir, selalu positif. Sisa yang belum dibayar dihitung dari `amount` dikurangi akumulasi `debt_payments` dan `debt_amount_adjustments` terkait, bukan kolom tersimpan terpisah. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`. `ON DELETE SET NULL`. Ini akun **representasi** piutang/utang itu sendiri (akun bertipe `debt` yang punya baris di `debt_accounts`) — beda peran dari `contact_id` (yang menjawab "siapa", kolom ini menjawab "tercatat di akun mana"). |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`. `ON DELETE SET NULL` — transaksi pokok dihapus, baris `debts` **tidak ikut hilang**, cuma kehilangan jejak "berasal dari transaksi mana". Lihat [transaction.md](transaction.md) untuk tabel `transactions`. |
| `status` | TEXT | ya | `ongoing` | `ongoing` (masih berjalan), `paid` (lunas penuh), atau `written_off` (dihapuskan/diikhlaskan tanpa dibayar) — dibatasi `CHECK`. Piutang/utang `ongoing` yang dihitung sebagai "masih berjalan" di ringkasan. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `date` | TEXT | ya | - | Tanggal piutang/utang ini lahir. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `source` | TEXT | ya | `manual` | `manual` atau `retailku_sync`, dibatasi `CHECK`. Menandai baris dibuat lewat form biasa atau hasil sinkronisasi dari Retailku (POS/warung terpisah). |
| `source_ref` | TEXT | tidak | NULL | Referensi id di sistem asal (Retailku). NULL kalau `source = 'manual'`. Dipasangkan dengan `source` lewat `idx_debts_source_ref` — lihat Catatan. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. Bagian mekanisme sinkronisasi cloud Worker/MCP. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — menandai asal perubahan terakhir untuk sinkronisasi cloud Worker/MCP. |

## `debt_payments`

Riwayat pelunasan/cicilan atas sebuah `debts`. Satu `debts` bisa punya banyak baris `debt_payments` (dicicil bertahap), dan satu pembayaran transfer bisa teralokasi ke beberapa `debts` sekaligus secara FIFO (masing-masing jadi baris terpisah di sini) — lihat konsep-utang-piutang.md bagian "Satu pelunasan bisa untuk beberapa piutang sekaligus".

### SQL final

```sql
CREATE TABLE debt_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
CREATE UNIQUE INDEX idx_debt_payments_source_ref
    ON debt_payments(source, source_ref)
    WHERE source_ref IS NOT NULL;
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `debt_id` | TEXT | ya | - | FK ke `debts(id)`. `ON DELETE CASCADE` — `debts` induk dihapus, seluruh riwayat pembayarannya ikut terhapus. |
| `amount` | REAL | ya | - | Nominal yang dibayarkan pada pelunasan ini, selalu positif. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`. `ON DELETE SET NULL`. Akun kas yang dipakai membayar — NULL kalau pelunasan lahir dari jalur income/expense langsung tanpa akun kas yang ikut berpindah (lihat konsep-utang-piutang.md Jalur 2). |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`. `ON DELETE SET NULL` — transaksi cicilan dihapus, baris pelunasan ini ikut dibatalkan secara terpisah (lihat Catatan), bukan sekadar field ini jadi NULL. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `date` | TEXT | ya | - | Tanggal pelunasan ini terjadi. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `source` | TEXT | ya | `manual` | `manual` atau `retailku_sync`, dibatasi `CHECK`, sama makna seperti di `debts`. |
| `source_ref` | TEXT | tidak | NULL | Referensi id pembayaran di sistem asal (Retailku). NULL kalau `source = 'manual'`. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah, bagian sinkronisasi cloud Worker/MCP. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, menandai asal perubahan terakhir untuk sinkronisasi cloud Worker/MCP. |

## `debt_amount_adjustments`

Riwayat koreksi nominal atas sebuah `debts` di luar mekanisme pelunasan normal (`debt_payments`) — mis. koreksi karena kesalahan input, bukan karena ada pembayaran yang terjadi.

### SQL final

```sql
CREATE TABLE debt_amount_adjustments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    delta REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_debt_amount_adjustments_debt ON debt_amount_adjustments(debt_id);
CREATE INDEX idx_debt_amount_adjustments_transaction ON debt_amount_adjustments(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `debt_id` | TEXT | ya | - | FK ke `debts(id)`. `ON DELETE CASCADE` — `debts` induk dihapus, riwayat koreksinya ikut terhapus. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`. `ON DELETE SET NULL` — transaksi terkait dihapus, baris koreksi ini tetap ada, hanya kehilangan jejak transaksinya. |
| `delta` | REAL | ya | - | Selisih koreksi, bisa positif atau negatif (menambah atau mengurangi sisa piutang/utang). Beda dari `debt_payments.amount` yang selalu positif dan punya makna pelunasan tunggal. |
| `date` | TEXT | ya | - | Tanggal koreksi ini terjadi. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- **Relasi keempat tabel**: `debt_accounts.account_id` adalah PK sekaligus FK ke `accounts(id)` — tabel ekstensi satu-ke-satu, hanya ada untuk akun bertipe `debt`. `debts.account_id` menunjuk ke akun representasi itu (akun mana piutang/utang ini tercatat), sedangkan `debts.contact_id` menunjuk ke pihak lawannya (siapa yang berutang/dipinjami) — dua FK dengan peran berbeda, jangan tertukar. `debt_payments` dan `debt_amount_adjustments` masing-masing `REFERENCES debts(id) ON DELETE CASCADE` — riwayat pelunasan dan koreksi nominal ikut terhapus kalau `debts` induknya dihapus.
- **Sisa piutang/utang tidak disimpan** — selalu dihitung dari `debts.amount` dikurangi/ditambah akumulasi `debt_payments.amount` dan `debt_amount_adjustments.delta` milik `debt_id` yang sama, baru dibandingkan ke `debts.status`.
- **`source`/`source_ref` dan UNIQUE partial index** — `debts` dan `debt_payments` masing-masing punya kolom `source` (`manual`/`retailku_sync`) dan `source_ref`, dipasangkan lewat `idx_debts_source_ref`/`idx_debt_payments_source_ref`: `UNIQUE (source, source_ref) WHERE source_ref IS NOT NULL`. Tujuannya mencegah baris duplikat masuk tiap kali proses sinkronisasi dari Retailku (POS warung terpisah) berjalan ulang — baris manual (`source_ref` NULL) tidak terkena constraint ini. `debt_amount_adjustments` tidak punya mekanisme serupa, tidak disinkronkan dari Retailku.
- **Kolom sync** (`updated_at`, `deleted_at`, `sync_source`) ada di `debts` dan `debt_payments` untuk mendukung soft-delete dan sinkronisasi cloud Worker/MCP — `debt_amount_adjustments` dan `debt_accounts` sengaja tidak punya kolom ini (lebih sederhana, belum perlu sinkronisasi independen). Trigger `trg_debts_updated_at` dan `trg_debt_payments_updated_at` masing-masing otomatis menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- **Rujukan balik ke `transactions`**: `debts.transaction_id`, `debt_payments.transaction_id`, dan `debt_amount_adjustments.transaction_id` masing-masing menunjuk ke transaksi yang melahirkan/terkait dengan baris itu — satu transaksi bisa melahirkan satu `debts` baru (lihat alur Jalur 1/Jalur 2 di konsep-utang-piutang.md). Semua `ON DELETE SET NULL`, bukan CASCADE — menghapus transaksi tidak ikut menghapus riwayat piutang/utangnya, cuma kehilangan jejak "berasal dari transaksi mana" (detail aturan edit/hapus transaksi terkait ada di konsep-utang-piutang.md). Lihat [transaction.md](transaction.md) untuk detail tabel `transactions` itu sendiri.
- Lihat juga [account.md](account.md) untuk tabel `accounts` yang direferensikan `debt_accounts.account_id` dan `debts.account_id`.

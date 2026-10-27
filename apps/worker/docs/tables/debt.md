# Tabel `debts`, `debt_payments`, `debt_accounts`, `debt_amount_adjustments`

Empat tabel domain utang-piutang, di-sync dari desktop ke D1 lewat Worker, dibaca juga oleh MCP server untuk tool-tool MCP. Peran tabel-tabel ini di worker murni sebagai **target sinkronisasi cloud** — `debt_accounts` menandai akun bertipe `debt` dan arahnya, `debts` adalah catatan satu piutang/utang, `debt_payments` riwayat pelunasan bertahap, dan `debt_amount_adjustments` riwayat koreksi nominal di luar pelunasan normal. Lihat [konsep-utang-piutang.md](../../../../docs/concept/konsep-utang-piutang.md) untuk model bisnis lengkapnya (arah `direction`, dua jalur kelahiran, FIFO alokasi pelunasan, aturan edit/hapus transaksi terkait) — dokumen itu menjelaskan sudut pandang desktop, bukan khusus worker. Skema di bawah diambil langsung dari introspeksi `sqlite_master` D1 production (bukan rekonstruksi migrasi), dibandingkan terhadap [debt.md desktop](../../../desktop/docs/tables/debt.md) sebagai referensi sumbernya.

## `debt_accounts`

Tabel ekstensi satu-ke-satu untuk `accounts` bertipe `debt`, dibuat di `0007_debt_account_direction.sql`.

### SQL final

```sql
CREATE TABLE debt_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key sekaligus FK ke `accounts(id)`, `ON DELETE CASCADE` — akun dihapus, baris ekstensi ini ikut terhapus. Relasi satu-ke-satu murni (PK = FK). |
| `direction` | TEXT | ya | - | `receivable` atau `payable`, dibatasi `CHECK`. Sumber kebenaran untuk `debts.type`, bukan ditebak dari arah transaksi. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 — nilai wajib dikirim eksplisit oleh pemanggil (kode sync Worker/MCP). |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Harus diisi manual oleh kode TypeScript Worker** tiap `UPDATE` — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK` — asal perubahan terakhir untuk resolusi sync. |

**Perbedaan penting dari desktop**: versi desktop `debt_accounts` HANYA punya dua kolom (`account_id`, `direction`) — sengaja tanpa kolom sync sama sekali, karena dianggap belum perlu sinkronisasi independen. Versi D1 di atas DITAMBAH `created_at`/`updated_at`/`deleted_at`/`sync_source` penuh, sama pola LWW dengan tabel lain di worker — ditambahkan khusus di migrasi `0007_debt_account_direction.sql` (komentar migrasi itu menyebutnya eksplisit: "DITAMBAH updated_at/deleted_at/sync_source LWW yang tidak dipunyai desktop").

## `debts`

Satu baris = satu piutang/utang yang lahir dari sebuah transaksi.

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
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
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
| `id` | TEXT | ya | - | Primary key, sama dengan `id` baris asal di desktop (UUID). |
| `type` | TEXT | ya | - | `receivable` atau `payable`, dibatasi `CHECK`. Selalu sejenis dengan `debt_accounts.direction` akun yang melahirkannya. |
| `contact_id` | TEXT | tidak | NULL | FK ke `contacts(id)`, `ON DELETE SET NULL`. Pihak lawan piutang/utangnya. |
| `amount` | REAL | ya | - | Nominal pokok saat lahir, selalu positif. Sisa dihitung dari `amount` dikurangi akumulasi `debt_payments`/`debt_amount_adjustments`, bukan kolom tersimpan. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`, `ON DELETE SET NULL`. Akun representasi piutang/utang itu sendiri. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi pokok dihapus, baris `debts` tetap ada. |
| `status` | TEXT | ya | `ongoing` | `ongoing`, `paid`, atau `written_off`, dibatasi `CHECK`. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `date` | TEXT | ya | - | Tanggal piutang/utang lahir. |
| `source` | TEXT | ya | `manual` | `manual` atau `retailku_sync`, dibatasi `CHECK`. |
| `source_ref` | TEXT | tidak | NULL | Referensi id di sistem asal (Retailku). Dipasangkan dengan `source` lewat `idx_debts_source_ref` — lihat Catatan. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 (beda dari desktop yang punya default ini) — wajib diisi eksplisit oleh pemanggil. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Harus diisi manual oleh kode TypeScript Worker** tiap `UPDATE` — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK`. |

## `debt_payments`

Riwayat pelunasan/cicilan atas sebuah `debts`.

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
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'retailku_sync')),
    source_ref TEXT,
    created_at TEXT NOT NULL,
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
| `debt_id` | TEXT | ya | - | FK ke `debts(id)`, `ON DELETE CASCADE` — `debts` induk dihapus, riwayat pembayarannya ikut terhapus. |
| `amount` | REAL | ya | - | Nominal yang dibayarkan, selalu positif. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`, `ON DELETE SET NULL`. Akun kas yang dipakai membayar — NULL kalau pelunasan lahir dari jalur income/expense langsung. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL`. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `date` | TEXT | ya | - | Tanggal pelunasan. |
| `source` | TEXT | ya | `manual` | `manual` atau `retailku_sync`, dibatasi `CHECK`. |
| `source_ref` | TEXT | tidak | NULL | Referensi id pembayaran di sistem asal (Retailku). |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 (beda dari desktop) — wajib diisi eksplisit oleh pemanggil. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Harus diisi manual oleh kode TypeScript Worker** tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK`. |

## `debt_amount_adjustments`

Riwayat koreksi nominal atas sebuah `debts` di luar mekanisme pelunasan normal, dibuat di `0009_debt_amount_adjustments.sql`.

### SQL final

```sql
CREATE TABLE debt_amount_adjustments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    delta REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX idx_debt_amount_adjustments_debt ON debt_amount_adjustments(debt_id);
CREATE INDEX idx_debt_amount_adjustments_transaction ON debt_amount_adjustments(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `debt_id` | TEXT | ya | - | FK ke `debts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL`. |
| `delta` | REAL | ya | - | Selisih koreksi, bisa positif atau negatif. |
| `date` | TEXT | ya | - | Tanggal koreksi terjadi. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. **Punya DEFAULT** di D1 — beda dari `debts`/`debt_payments`/`debt_accounts` di atas yang `created_at`-nya TIDAK punya default sama sekali. Lihat Catatan. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu terakhir baris diubah. **`NOT NULL` dengan DEFAULT** — beda dari pola kolom sync di tabel lain (`debts`, `debt_payments`, `debt_accounts`) yang `updated_at`-nya nullable tanpa default. Karena tidak ada trigger di D1 (lihat Catatan), default ini HANYA berlaku saat `INSERT`, tidak otomatis terupdate saat `UPDATE` — kode Worker tetap wajib menyetelnya manual kalau mau nilainya akurat. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `manual` | **Anomali dibanding semua tabel lain**: default-nya `'manual'`, BUKAN `'pc'`, dan **tidak ada `CHECK` constraint** yang membatasi nilainya ke `('pc', 'mcp')` sama sekali — kolom ini bebas diisi string apa pun. Lihat Catatan, ini tampak seperti inkonsistensi/anomali, bukan perubahan desain yang disengaja dan konsisten.

## Catatan

- **`debt_accounts` punya kolom sync, desktop tidak** — lihat bagian `debt_accounts` di atas. Ini satu-satunya dari keempat tabel yang strukturnya benar-benar berbeda jumlah kolom dari versi desktop, bukan cuma beda default/trigger.
- **`debt_amount_adjustments.sync_source` adalah anomali terverifikasi** — pola di SEMUA tabel lain di worker (termasuk tiga tabel lain di file ini) adalah `sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))`. Tabel ini sendirian memakai `DEFAULT 'manual'` TANPA `CHECK` apa pun. Belum jelas apakah ini disengaja (mis. menandai baris yang memang selalu dibuat manual, tidak pernah lewat sync `pc`/`mcp`) atau cuma kelewat saat `0009_debt_amount_adjustments.sql` ditulis — dicatat sebagai observasi, BUKAN dikoreksi diam-diam di dokumen ini. Konsekuensi praktis: baris ini tidak punya jaring pengaman DB kalau kode Worker suatu saat menulis nilai `sync_source` yang typo.
- **`debt_amount_adjustments.created_at`/`updated_at` juga pola sendiri** — satu-satunya di antara keempat tabel yang punya `DEFAULT (datetime('now'))` untuk keduanya. `debts`, `debt_payments`, `debt_accounts` semuanya `created_at NOT NULL` TANPA default (wajib diisi eksplisit) dan `updated_at` nullable TANPA default.
- **Tidak ada trigger apa pun di D1** (`sqlite_master` type `trigger` kosong, terverifikasi) — beda dari desktop yang punya trigger auto-update `updated_at` (`trg_debts_updated_at`, `trg_debt_payments_updated_at`) untuk `debts`/`debt_payments`. Di Worker, SETIAP kode yang melakukan `UPDATE` ke keempat tabel ini wajib menyetel `updated_at` secara eksplisit (`datetime('now')` atau setara) — tidak ada mekanisme DB-level yang menimpanya otomatis, termasuk untuk `debt_amount_adjustments` meski kolomnya punya DEFAULT (default SQL hanya berlaku di `INSERT`, bukan `UPDATE`).
- **Relasi antar tabel** sama dengan desktop: `debt_accounts.account_id` adalah PK sekaligus FK ke `accounts(id)`; `debts.account_id` menunjuk akun representasi, `debts.contact_id` menunjuk pihak lawan; `debt_payments`/`debt_amount_adjustments` masing-masing `REFERENCES debts(id) ON DELETE CASCADE`.
- **Sisa piutang/utang tidak disimpan** — tetap dihitung dari `debts.amount` dikurangi/ditambah akumulasi `debt_payments.amount`/`debt_amount_adjustments.delta`, sama seperti desktop.
- Lihat [account.md](account.md) untuk tabel `accounts` yang direferensikan, dan [konsep-utang-piutang.md](../../../../docs/concept/konsep-utang-piutang.md) untuk makna bisnis lengkap kolom-kolom di atas.

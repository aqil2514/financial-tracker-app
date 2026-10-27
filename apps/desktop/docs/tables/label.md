# Tabel `labels`, `account_labels`, `category_labels`, `transaction_labels`

Label adalah tag bebas yang bisa dipasang ke akun, kategori, atau transaksi untuk pengelompokan tambahan di luar struktur `account_groups`/`categories` yang sudah ada. Satu tabel `labels` menyimpan daftar label itu sendiri, lalu tiga tabel junction (`account_labels`, `category_labels`, `transaction_labels`) menyimpan relasi many-to-many ke masing-masing entitas. Tidak ada dokumen konsep khusus untuk label — isi dokumen ini murni disimpulkan dari skema dan nama kolom, bukan dari spesifikasi UI/fitur yang terverifikasi terpisah.

## `labels`

### SQL final

```sql
CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (name, scope)
);

CREATE INDEX idx_labels_scope ON labels(scope);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama label. |
| `scope` | TEXT | ya | - | `transaction_category` atau `account` — dibatasi `CHECK`. Satu label punya satu scope tetap sejak dibuat; berdasarkan skema, scope ini kemungkinan menentukan label itu dipasang ke kategori+transaksi (`transaction_category`) atau ke akun (`account`), tidak bisa ke keduanya sekaligus. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan label

- `UNIQUE (name, scope)` — nama label unik dalam scope yang sama; dua scope berbeda boleh punya nama label yang sama.
- Tidak ditemukan dokumen konsep (`docs/concept/*`) yang membahas label, jadi penjelasan `scope` di atas adalah observasi dari skema saja, bukan klaim pasti soal perilaku UI picker label.

## `account_labels`

Relasi many-to-many antara `accounts` dan `labels`.

### SQL final

```sql
CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (account_id, label_id)
);

CREATE INDEX idx_account_labels_account ON account_labels(account_id);
CREATE INDEX idx_account_labels_label ON account_labels(label_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`. `ON DELETE CASCADE` — akun dihapus, baris relasi labelnya ikut terhapus. |
| `label_id` | TEXT | ya | - | FK ke `labels(id)`. `ON DELETE CASCADE` — label dihapus, baris relasi di akun yang memakainya ikut terhapus. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan account_labels

- `UNIQUE (account_id, label_id)` — satu akun tidak bisa punya label yang sama terpasang dua kali, tapi satu akun bisa punya banyak label berbeda, dan satu label bisa dipasang ke banyak akun.
- Lihat [account.md](account.md) untuk tabel `accounts`.

## `category_labels`

Relasi many-to-many antara `categories` dan `labels`.

### SQL final

```sql
CREATE TABLE category_labels (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (category_id, label_id)
);

CREATE INDEX idx_category_labels_category ON category_labels(category_id);
CREATE INDEX idx_category_labels_label ON category_labels(label_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `category_id` | TEXT | ya | - | FK ke `categories(id)`. `ON DELETE CASCADE` — kategori dihapus, baris relasi labelnya ikut terhapus. |
| `label_id` | TEXT | ya | - | FK ke `labels(id)`. `ON DELETE CASCADE` — label dihapus, baris relasi di kategori yang memakainya ikut terhapus. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan category_labels

- `UNIQUE (category_id, label_id)` — satu kategori tidak bisa punya label yang sama terpasang dua kali, tapi satu kategori bisa punya banyak label berbeda, dan satu label bisa dipasang ke banyak kategori.
- Lihat [category.md](category.md) untuk tabel `categories`.

## `transaction_labels`

Relasi many-to-many antara `transactions` dan `labels`.

### SQL final

```sql
CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (transaction_id, label_id)
);

CREATE INDEX idx_transaction_labels_transaction ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `transaction_id` | TEXT | ya | - | FK ke `transactions(id)`. `ON DELETE CASCADE` — transaksi dihapus, baris relasi labelnya ikut terhapus. |
| `label_id` | TEXT | ya | - | FK ke `labels(id)`. `ON DELETE CASCADE` — label dihapus, baris relasi di transaksi yang memakainya ikut terhapus. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan transaction_labels

- `UNIQUE (transaction_id, label_id)` — satu transaksi tidak bisa punya label yang sama terpasang dua kali, tapi satu transaksi bisa punya banyak label berbeda, dan satu label bisa dipasang ke banyak transaksi.
- Lihat [transaction.md](transaction.md) untuk tabel `transactions`.

## Catatan umum

- Ketiga tabel junction (`account_labels`, `category_labels`, `transaction_labels`) strukturnya identik: `id`, kolom FK ke entitas, `label_id`, lalu kolom sync yang sama (`created_at`, `updated_at`, `deleted_at`, `sync_source`) dan constraint `UNIQUE` dua kolom.
- Semua FK di keempat tabel ini pakai `ON DELETE CASCADE` — tidak ada mekanisme unassign/reassign seperti di `accounts`/`categories`, baris relasi langsung ikut terhapus mengikuti induknya.
- Kolom `updated_at`, `deleted_at`, `sync_source` di keempat tabel dipakai untuk soft-delete dan sinkronisasi dengan Worker/MCP — mekanisme penuhnya tidak dibahas di sini. Trigger `trg_labels_updated_at`, `trg_account_labels_updated_at`, `trg_category_labels_updated_at`, dan `trg_transaction_labels_updated_at` masing-masing otomatis menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.

# Tabel `labels`, `account_labels`, `category_labels`, `transaction_labels`

Mirror dari domain label desktop — `labels` menyimpan daftar label, tiga tabel junction (`account_labels`, `category_labels`, `transaction_labels`) menyimpan relasi many-to-many ke `accounts`/`categories`/`transactions`. Tidak ada dokumen konsep khusus untuk label (sama seperti catatan di versi desktop) — isi dokumen ini murni disimpulkan dari skema dan nama kolom. Lihat [label.md desktop](../../../desktop/docs/tables/label.md) untuk versi sumbernya. Skema di sini diambil langsung dari introspeksi `sqlite_master` D1 production.

## `labels`

### SQL final

```sql
CREATE TABLE labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
    created_at TEXT NOT NULL,
    updated_at TEXT,
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
| `scope` | TEXT | ya | - | `transaction_category` atau `account` — dibatasi `CHECK`. Satu label punya satu scope tetap sejak dibuat; kemungkinan menentukan label dipasang ke kategori+transaksi atau ke akun, tidak keduanya sekaligus (observasi dari skema, bukan klaim pasti UI). |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 — kode Worker wajib mengisi nilai ini sendiri saat `INSERT`. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir diubah, dipakai mekanisme sync. **Nullable, tanpa DEFAULT, tanpa trigger auto-update** — kode Worker wajib set manual tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan label

- `UNIQUE (name, scope)` — nama label unik dalam scope yang sama; dua scope berbeda boleh punya nama label yang sama.
- Tidak ditemukan dokumen konsep (`docs/concept/*`) yang membahas label, jadi penjelasan `scope` di atas adalah observasi dari skema saja.
- **Tidak ada trigger di D1** untuk auto-update `updated_at` (beda dari desktop yang punya `trg_labels_updated_at`) — lihat "Catatan umum" di bawah.

## `account_labels`

Relasi many-to-many antara `accounts` dan `labels`.

### SQL final

```sql
CREATE TABLE account_labels (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
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
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 — wajib diisi manual oleh kode Worker. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir diubah, dipakai mekanisme sync. **Nullable, tanpa DEFAULT, tanpa trigger** — wajib di-set manual tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan account_labels

- `UNIQUE (account_id, label_id)` — satu akun tidak bisa punya label yang sama terpasang dua kali, tapi satu akun bisa punya banyak label berbeda, dan satu label bisa dipasang ke banyak akun.
- **Tidak ada trigger di D1** untuk auto-update `updated_at` (beda dari desktop yang punya `trg_account_labels_updated_at`).

## `category_labels`

Relasi many-to-many antara `categories` dan `labels`.

### SQL final

```sql
CREATE TABLE category_labels (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
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
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 — wajib diisi manual oleh kode Worker. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir diubah, dipakai mekanisme sync. **Nullable, tanpa DEFAULT, tanpa trigger** — wajib di-set manual tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan category_labels

- `UNIQUE (category_id, label_id)` — satu kategori tidak bisa punya label yang sama terpasang dua kali, tapi satu kategori bisa punya banyak label berbeda, dan satu label bisa dipasang ke banyak kategori.
- **Tidak ada trigger di D1** untuk auto-update `updated_at` (beda dari desktop yang punya `trg_category_labels_updated_at`).

## `transaction_labels`

Relasi many-to-many antara `transactions` dan `labels`.

### SQL final

```sql
CREATE TABLE transaction_labels (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
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
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 — wajib diisi manual oleh kode Worker. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir diubah, dipakai mekanisme sync. **Nullable, tanpa DEFAULT, tanpa trigger** — wajib di-set manual tiap `UPDATE`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

### Catatan transaction_labels

- `UNIQUE (transaction_id, label_id)` — satu transaksi tidak bisa punya label yang sama terpasang dua kali, tapi satu transaksi bisa punya banyak label berbeda, dan satu label bisa dipasang ke banyak transaksi.
- **Tidak ada trigger di D1** untuk auto-update `updated_at` (beda dari desktop yang punya `trg_transaction_labels_updated_at`).

## Catatan umum

- Keempat tabel strukturnya sama dengan versi desktop KECUALI untuk `created_at`/`updated_at`: di D1, `created_at` adalah `TEXT NOT NULL` tanpa `DEFAULT (datetime('now'))`, dan `updated_at` adalah `TEXT` nullable tanpa default — berbeda dari desktop yang keduanya `NOT NULL DEFAULT (datetime('now'))`. Tidak ada kolom lain yang hilang atau bertambah dibanding desktop.
- **Tidak ada trigger sama sekali di D1** (`sqlite_master` type `trigger` kosong) — berbeda dari desktop yang punya `trg_labels_updated_at`, `trg_account_labels_updated_at`, `trg_category_labels_updated_at`, dan `trg_transaction_labels_updated_at` untuk auto-update `updated_at`. Di Worker, kode TypeScript yang melakukan `UPDATE` ke salah satu dari keempat tabel ini WAJIB menyertakan `updated_at = datetime('now')` (atau timestamp setara) secara manual — tanpa ini, `updated_at` tidak pernah berubah.
- Ketiga tabel junction (`account_labels`, `category_labels`, `transaction_labels`) strukturnya identik satu sama lain: `id`, kolom FK ke entitas, `label_id`, lalu kolom sync yang sama dan constraint `UNIQUE` dua kolom.
- Semua FK di keempat tabel ini pakai `ON DELETE CASCADE` — tidak ada mekanisme unassign/reassign, baris relasi langsung ikut terhapus mengikuti induknya.
- Lihat juga [third-party-fund.md](third-party-fund.md) untuk pola `created_at`/`updated_at` tanpa DEFAULT/trigger yang sama di Worker.

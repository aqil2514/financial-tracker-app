# Tabel `category_periods` dan `category_period_categories`

Kategori Periode: jendela tanggal custom bernama (mis. "Musim Panen 2026") yang mengikat banyak kategori sekaligus, lintas tipe `income` maupun `expense`. **Bukan fitur anggaran/budget** — tidak ada batas pengeluaran, tidak ada status "melebihi anggaran". Fungsinya murni meringkas total masuk/keluar dari kategori-kategori tertentu dalam rentang tanggal tertentu, dihitung ulang langsung dari `transactions` tiap kali dilihat (tidak ada kolom ringkasan tersimpan). Lihat [konsep-kategori.md](../../../../docs/concept/konsep-kategori.md) bagian "Kategori Periode".

Dua tabel: `category_periods` (periode itu sendiri) dan `category_period_categories` (junction table banyak-ke-banyak ke `categories`).

## SQL final

```sql
CREATE TABLE "category_periods" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE TABLE category_period_categories (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp')),
    UNIQUE (period_id, category_id)
);

CREATE INDEX idx_category_period_categories_period ON category_period_categories(period_id);
CREATE INDEX idx_category_period_categories_category ON category_period_categories(category_id);
```

## Kolom — `category_periods`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama periode, bebas (mis. "Musim Panen 2026"). |
| `start_date` | TEXT | ya | - | Tanggal mulai jendela periode. |
| `end_date` | TEXT | ya | - | Tanggal akhir jendela periode. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

## Kolom — `category_period_categories`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `period_id` | TEXT | ya | - | FK ke `category_periods(id)`. `ON DELETE CASCADE` — periode dihapus, semua assignment-nya ikut terhapus. |
| `category_id` | TEXT | ya | - | FK ke `categories(id)`. `ON DELETE CASCADE` — kategori dihapus, assignment ke periode manapun ikut terhapus. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |
| — | — | — | — | `UNIQUE (period_id, category_id)` — satu kategori tidak bisa diassign dobel ke periode yang sama. |

## Catatan

- Ringkasan total masuk/keluar per periode dihitung dengan `WHERE category_id IN (...) AND date BETWEEN start_date AND end_date` terhadap `transactions` — tidak ada tabel ledger/snapshot sendiri, tidak ada kolom ringkasan tersimpan di kedua tabel ini.
- Kolom `updated_at`, `deleted_at`, `sync_source` di kedua tabel dipakai untuk soft-delete dan sinkronisasi dengan Worker/MCP — mekanisme penuhnya tidak dibahas di sini.
- Trigger `trg_category_periods_updated_at` dan `trg_category_period_categories_updated_at` masing-masing otomatis menimpa `updated_at` tabelnya dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- Lihat juga [category.md](category.md) untuk tabel kategori itu sendiri, termasuk field `icon` yang mati.

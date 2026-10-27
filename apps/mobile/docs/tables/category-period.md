
# Tabel `category_periods` dan `category_period_categories`

Kategori Periode: jendela tanggal custom bernama (mis. "Musim Panen 2026") yang mengikat banyak kategori sekaligus, lintas tipe `income` maupun `expense`. **Bukan fitur anggaran/budget** — tidak ada batas pengeluaran, tidak ada status "melebihi anggaran". Fungsinya murni meringkas total masuk/keluar dari kategori-kategori tertentu dalam rentang tanggal tertentu, dihitung ulang langsung dari `transactions` tiap kali dilihat (tidak ada kolom ringkasan tersimpan). Lihat [konsep-kategori.md](../../../../docs/concept/konsep-kategori.md) bagian "Kategori Periode".

Dua tabel: `category_periods` (periode itu sendiri) dan `category_period_categories` (junction table banyak-ke-banyak ke `categories`). Keduanya dibuat bersama di migrasi `0003_categories.ts`.

## SQL final

```sql
CREATE TABLE category_periods (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE category_period_categories (
  id TEXT PRIMARY KEY NOT NULL,
  period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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

## Kolom — `category_period_categories`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `period_id` | TEXT | ya | - | FK ke `category_periods(id)`. `ON DELETE CASCADE` — periode dihapus, semua assignment-nya ikut terhapus. |
| `category_id` | TEXT | ya | - | FK ke `categories(id)`. `ON DELETE CASCADE` — kategori dihapus, assignment ke periode manapun ikut terhapus. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| — | — | — | — | `UNIQUE (period_id, category_id)` — satu kategori tidak bisa diassign dobel ke periode yang sama. |

## Catatan

- Ringkasan total masuk/keluar per periode dihitung dengan `WHERE category_id IN (...) AND date BETWEEN start_date AND end_date` terhadap `transactions` — tidak ada tabel ledger/snapshot sendiri.
- Update assignment kategori ke periode (saat edit) dilakukan dengan hapus semua baris `category_period_categories` milik periode itu lalu insert ulang dari pilihan baru — bukan diff granular, karena junction table ini kecil.
- Status "Berlangsung"/"Selesai" di UI list adalah turunan (`date('now') BETWEEN start_date AND end_date`), bukan kolom tersimpan.
- Lihat juga [category.md](category.md) untuk tabel kategori itu sendiri.

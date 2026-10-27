
# Tabel `categories`

Label klasifikasi untuk transaksi `income`/`expense` — menjelaskan "untuk apa" sebuah transaksi terjadi (mis. "Makan", "Gaji"). Transaksi bertipe `transfer` tidak pakai kategori sama sekali. Lihat [konsep-kategori.md](../../../../docs/concept/konsep-kategori.md) untuk konsep lengkapnya.

Dibuat di migrasi `0003_categories.ts`.

## SQL final

```sql
CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama kategori. Konvensi mobile: emoji boleh diketik langsung di depan nama (mis. "🍔 Makanan") sebagai pengganti field icon — lihat catatan `icon` di bawah. |
| `icon` | TEXT | tidak | NULL | **Kolom mati** — tidak ada field/UI apa pun di mobile yang mengisi atau menampilkan kolom ini (sama seperti desktop). Pengganti visualnya adalah emoji yang ditempel user langsung di `name`. |
| `type` | TEXT | ya | - | `income` atau `expense` — dibatasi `CHECK`. Tidak ada tipe gabungan; kategori anak wajib satu tipe dengan induknya. |
| `parent_id` | TEXT | tidak | NULL | Self-reference ke `categories(id)`. `ON DELETE SET NULL`. Secara skema tidak dibatasi kedalaman, tapi UI hanya memperlakukan ini sebagai dua level (akar + anak langsung). |
| `is_active` | INTEGER | ya | 1 | Boolean (0/1). Toggle cepat dari list untuk menyembunyikan kategori dari opsi pemilihan tanpa menghapus riwayat transaksi yang masih menempel. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- `transactions.category_id` punya FK ke tabel ini sejak migrasi `0004` (`ON DELETE SET NULL`) — lihat [transaction.md](transaction.md).
- Menghapus kategori yang masih punya sub-kategori dan/atau transaksi terkait mewajibkan pilihan eksplisit "lepas" (unassign ke NULL) atau "pindahkan" (reassign ke kategori/induk lain) lebih dulu — tidak ada penghapusan diam-diam yang meninggalkan baris yatim.
- Lihat juga [category-period.md](category-period.md) untuk fitur ringkasan lintas kategori yang terpisah dari tabel ini.

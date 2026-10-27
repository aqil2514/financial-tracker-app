# Tabel `categories`

Label klasifikasi untuk transaksi `income`/`expense` — menjelaskan "untuk apa" sebuah transaksi terjadi (mis. "Makan", "Gaji"). Transaksi bertipe `transfer` tidak pakai kategori sama sekali. Lihat [konsep-kategori.md](../../../../docs/concept/konsep-kategori.md) untuk konsep lengkapnya.

## SQL final

```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama kategori. |
| `icon` | TEXT | tidak | NULL | **Kolom mati** — tidak pernah ditampilkan atau diisi di form/UI desktop manapun, peninggalan seed data awal. Beda dari `accounts.icon` yang aktif dipakai. Tidak ada field warna sama sekali untuk kategori. |
| `type` | TEXT | ya | - | `income` atau `expense` — dibatasi `CHECK`. Tidak ada tipe gabungan lintas keduanya; kategori anak wajib satu tipe dengan induknya. |
| `parent_id` | TEXT | tidak | NULL | Self-reference ke `categories(id)`. `ON DELETE SET NULL`. Secara skema tidak dibatasi kedalaman, tapi UI hanya memperlakukan ini sebagai dua level (akar + anak langsung), tidak ada rekursi lebih dalam. |
| `is_active` | INTEGER | ya | 1 | Boolean (0/1). Toggle cepat dari list untuk menyembunyikan kategori dari opsi pemilihan tanpa menghapus riwayat transaksi yang masih menempel ke kategori itu. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir diubah, dipakai mekanisme sync. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `'pc'` | Asal perubahan terakhir (`pc` atau `mcp`), dipakai mekanisme sync Worker/MCP. |

## Catatan

- `transactions.category_id` punya FK ke tabel ini (`ON DELETE SET NULL`) — akan didokumentasikan terpisah di `transaction.md`.
- Menghapus kategori yang masih punya sub-kategori dan/atau transaksi terkait mewajibkan pilihan eksplisit "lepas" (unassign ke NULL) atau "pindahkan" (reassign ke kategori/induk lain) lebih dulu — tidak ada penghapusan diam-diam yang meninggalkan baris yatim.
- Kolom `updated_at`, `deleted_at`, `sync_source` dipakai untuk soft-delete dan sinkronisasi dengan Worker/MCP — mekanisme penuhnya tidak dibahas di sini.
- Trigger `trg_categories_updated_at` otomatis menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- Lihat juga [category-period.md](category-period.md) untuk fitur ringkasan lintas kategori yang terpisah dari tabel ini.

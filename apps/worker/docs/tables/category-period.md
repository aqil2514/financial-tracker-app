# Tabel `category_periods` dan `category_period_categories`

Kategori Periode, di-sync dari desktop ke D1 lewat Worker. Peran kedua tabel ini di worker murni sebagai **target sinkronisasi cloud** — baris di sini adalah salinan hasil sync dari `apps/desktop`, dibaca juga oleh MCP server. Lihat [konsep-kategori.md](../../../../docs/concept/konsep-kategori.md) bagian "Kategori Periode" untuk konsep lengkapnya dari sudut pandang desktop — bukan fitur anggaran/budget, murni meringkas total masuk/keluar kategori-kategori tertentu dalam rentang tanggal tertentu.

Dua tabel: `category_periods` (periode itu sendiri) dan `category_period_categories` (junction table banyak-ke-banyak ke `categories`).

## SQL final

```sql
CREATE TABLE category_periods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE TABLE category_period_categories (
    id TEXT PRIMARY KEY,
    period_id TEXT NOT NULL REFERENCES category_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    updated_at TEXT,
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
| `id` | TEXT | ya | - | Primary key, sama dengan `id` baris asal di desktop (UUID). |
| `name` | TEXT | ya | - | Nama periode, disalin apa adanya dari desktop. |
| `start_date` | TEXT | ya | - | Tanggal mulai jendela periode. |
| `end_date` | TEXT | ya | - | Tanggal akhir jendela periode. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 (beda dari desktop) — wajib dikirim eksplisit oleh pemanggil. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Beda dari desktop**: di desktop kolom ini `NOT NULL DEFAULT (datetime('now'))`, di D1 kolom ini **nullable, tanpa default**. Harus diisi manual oleh kode TypeScript Worker setiap kali melakukan `UPDATE` — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir yang diterima Worker. |

## Kolom — `category_period_categories`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, sama dengan `id` baris asal di desktop (UUID). |
| `period_id` | TEXT | ya | - | FK ke `category_periods(id)`. `ON DELETE CASCADE` — periode dihapus, semua assignment-nya ikut terhapus. |
| `category_id` | TEXT | ya | - | FK ke `categories(id)`. `ON DELETE CASCADE` — kategori dihapus, assignment ke periode manapun ikut terhapus. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 (beda dari desktop) — wajib dikirim eksplisit oleh pemanggil. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Beda dari desktop**: di desktop kolom ini `NOT NULL DEFAULT (datetime('now'))`, di D1 kolom ini **nullable, tanpa default**. Harus diisi manual oleh kode TypeScript Worker setiap kali melakukan `UPDATE` — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir yang diterima Worker. |
| — | — | — | — | `UNIQUE (period_id, category_id)` — satu kategori tidak bisa diassign dobel ke periode yang sama. |

## Catatan

- **Tidak ada trigger apa pun di D1** (sudah diverifikasi lewat `sqlite_master WHERE type='trigger'` — hasilnya kosong). Ini beda total dari desktop yang punya 17 trigger auto-update `updated_at`, termasuk `trg_category_periods_updated_at` dan `trg_category_period_categories_updated_at`. Konsekuensinya: setiap endpoint/handler Worker yang melakukan `UPDATE` ke kedua tabel ini **wajib menyetel `updated_at` secara eksplisit di statement-nya sendiri** — tidak ada mekanisme DB-level yang menimpanya otomatis.
- **Perbedaan `updated_at` paling signifikan di dua tabel ini dibanding tabel lain yang didokumentasikan**: desktop mendeklarasikan `updated_at` sebagai `NOT NULL DEFAULT (datetime('now'))` untuk `category_periods` maupun `category_period_categories` (beda dari `accounts`/`account_groups`/`categories` yang di desktop pun `updated_at`-nya nullable tanpa default). Di D1, **semua** tabel termasuk kedua tabel ini menyamaratakan `updated_at` jadi nullable tanpa default — jadi untuk dua tabel ini, bukan cuma hilangnya trigger, tapi constraint kolomnya sendiri juga berubah (dari wajib+default jadi opsional+tanpa default).
- `created_at` di D1 **tidak** punya `DEFAULT (datetime('now'))` di kedua tabel, beda dari desktop yang punya default ini.
- Ringkasan total masuk/keluar per periode tetap dihitung on-the-fly dari `transactions` oleh pembaca data (desktop/MCP) — Worker tidak menjalankan agregasi ini sendiri, cuma menyimpan baris hasil sync.
- Lihat juga [category.md](category.md) untuk tabel kategori itu sendiri.

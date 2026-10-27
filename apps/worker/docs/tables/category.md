# Tabel `categories`

Label klasifikasi untuk transaksi `income`/`expense`, di-sync dari desktop ke D1 lewat Worker. Peran tabel ini di worker murni sebagai **target sinkronisasi cloud** — baris di sini adalah salinan hasil sync dari `apps/desktop`, dibaca juga oleh MCP server. Lihat [konsep-kategori.md](../../../../docs/concept/konsep-kategori.md) untuk konsep lengkapnya dari sudut pandang desktop.

## SQL final

```sql
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, sama dengan `id` baris asal di desktop (UUID). |
| `name` | TEXT | ya | - | Nama kategori, disalin apa adanya dari desktop. |
| `icon` | TEXT | tidak | NULL | **Kolom mati**, sama seperti di desktop — tidak diisi/ditampilkan UI manapun, cuma ikut disalin kalau ada nilainya. |
| `type` | TEXT | ya | - | `income` atau `expense` — dibatasi `CHECK`. |
| `parent_id` | TEXT | tidak | NULL | Self-reference ke `categories(id)`. `ON DELETE SET NULL`. |
| `is_active` | INTEGER | ya | 1 | Boolean (0/1). |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 (beda dari desktop yang punya default ini) — nilai wajib dikirim eksplisit oleh pemanggil (kode sync Worker/MCP), kalau tidak `INSERT` akan gagal karena kolom ini `NOT NULL` tanpa default. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Harus diisi manual oleh kode TypeScript Worker setiap kali melakukan `UPDATE`** — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker, dipakai mekanisme sync. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir yang diterima Worker. |

## Catatan

- **Tidak ada trigger apa pun di D1** (sudah diverifikasi lewat `sqlite_master WHERE type='trigger'` — hasilnya kosong). Ini beda total dari desktop yang punya 17 trigger auto-update `updated_at`. Konsekuensinya: setiap endpoint/handler Worker yang melakukan `UPDATE` ke tabel ini **wajib menyetel `updated_at` secara eksplisit di statement-nya sendiri** — tidak ada mekanisme DB-level yang menimpanya otomatis seperti di desktop (`trg_categories_updated_at`).
- `created_at` di D1 **tidak** punya `DEFAULT (datetime('now'))`, beda dari desktop yang punya default ini. Kode Worker yang insert baris baru wajib mengisi `created_at` sendiri.
- Verifikasi baris-per-baris terhadap skema desktop: semua kolom desktop (`id`, `name`, `icon`, `type`, `parent_id`, `is_active`, `created_at`, `updated_at`, `deleted_at`, `sync_source`) **ada** di D1, tidak ada yang hilang atau tambahan. Tidak ada field warna di kategori, sama seperti desktop.
- `transactions.category_id` punya FK ke tabel ini — tidak dibahas detail di dokumen ini.
- Tabel ini murni cermin dari sync, bukan sumber kebenaran — keputusan unassign/reassign saat hapus kategori terjadi di sisi desktop sebelum hasilnya di-sync ke sini, bukan logic yang berjalan di Worker.
- Lihat juga [category-period.md](category-period.md) untuk fitur ringkasan lintas kategori yang terpisah dari tabel ini.

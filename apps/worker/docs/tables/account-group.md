# Tabel `account_groups`

Label pengelompokan bebas untuk akun, di-sync dari desktop ke D1 lewat Worker. Peran tabel ini di worker murni sebagai **target sinkronisasi cloud** — baris di sini adalah salinan hasil sync dari `apps/desktop`, dibaca juga oleh MCP server. Grup ini netral, tidak membawa logic/fitur apa pun, murni wadah pengelompokan tampilan. Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) bagian "Grup akun untuk kasus campuran" untuk konsep lengkapnya di desktop.

## SQL final

```sql
CREATE TABLE account_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, sama dengan `id` baris asal di desktop (UUID). |
| `name` | TEXT | ya | - | Nama grup, disalin apa adanya dari desktop. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 (beda dari desktop yang punya default ini) — nilai wajib dikirim eksplisit oleh pemanggil (kode sync Worker/MCP), kalau tidak `INSERT` akan gagal karena kolom ini `NOT NULL` tanpa default. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Harus diisi manual oleh kode TypeScript Worker setiap kali melakukan `UPDATE`** — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker — baris tidak langsung hard delete, cuma ditandai terhapus di waktu ini. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir yang diterima Worker. |

## Catatan

- **Tidak ada trigger apa pun di D1** (sudah diverifikasi lewat `sqlite_master WHERE type='trigger'` — hasilnya kosong). Ini beda total dari desktop yang punya 17 trigger auto-update `updated_at`. Konsekuensinya: setiap endpoint/handler Worker yang melakukan `UPDATE` ke tabel ini **wajib menyetel `updated_at` secara eksplisit di statement-nya sendiri** — tidak ada mekanisme DB-level yang menimpanya otomatis seperti di desktop (`trg_account_groups_updated_at`).
- `created_at` di D1 **tidak** punya `DEFAULT (datetime('now'))`, beda dari desktop yang punya default ini. Kode Worker yang insert baris baru wajib mengisi `created_at` sendiri.
- `accounts.group_id` FK ke tabel ini dengan `ON DELETE SET NULL`, sama seperti desktop — grup dihapus, akun di dalamnya jadi "Tanpa Grup", bukan ikut terhapus. Lihat [account.md](account.md).
- Tabel ini murni cermin dari sync, bukan sumber kebenaran — perubahan "asli" tetap terjadi di desktop (atau lewat MCP), Worker/D1 cuma menyimpan hasil akhirnya untuk dibaca ulang.
- Lihat juga [account.md](account.md) untuk tabel akun yang mereferensikan tabel ini.

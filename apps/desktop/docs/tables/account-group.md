# Tabel `account_groups`

Label pengelompokan bebas untuk akun — murni untuk mengelompokkan tampilan (mis. accordion per grup di list akun), tidak membawa makna/logic finansial apa pun sendiri. Akun tanpa grup ("Tanpa Grup") tetap valid. Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) bagian "Grup akun untuk kasus campuran" — grup ini yang dipakai menjembatani kebutuhan tampilan saat satu sumber uang fisik perlu dipecah jadi beberapa akun virtual bertipe murni.

## SQL final

```sql
CREATE TABLE account_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama grup, bebas (mis. "Rekening Bank", "E-Wallet / Pribadi"). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. Bagian dari mekanisme sinkronisasi cloud Worker/MCP — lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) untuk konteks, detail mekanisme sync ada di dokumen lain. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker — baris tidak langsung hard delete, cuma ditandai terhapus di waktu ini. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir, dipakai logic sinkronisasi cloud Worker/MCP untuk tahu baris ini datang dari mana. |

## Catatan

- Grup sendiri **netral** — tidak membawa logic/fitur, murni wadah pengelompokan tampilan bebas pilihan pengguna, beda dari `accounts.account_type` yang murni teknis dan menentukan fitur apa yang aktif (lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md)).
- `accounts.group_id` FK ke tabel ini dengan `ON DELETE SET NULL` — grup dihapus, akun di dalamnya jadi "Tanpa Grup", bukan ikut terhapus.
- Trigger `trg_account_groups_updated_at` (`AFTER UPDATE ... WHEN NEW.updated_at = OLD.updated_at`) otomatis menimpa `updated_at` dengan `datetime('now')` kalau statement `UPDATE` tidak menyetelnya sendiri.
- Lihat juga [account.md](account.md) untuk tabel akun yang mereferensikan tabel ini.


# Tabel `account_groups`

Label pengelompokan bebas untuk akun — murni untuk mengelompokkan tampilan (mis. accordion per grup di list akun), tidak membawa makna/logic finansial apa pun sendiri. Akun tanpa grup ("Tanpa Grup") tetap valid.

Dibuat di migrasi `0005_accounts.ts`, bersamaan dengan `accounts` (lihat [account.md](account.md)) — lihat `docs/todos/plan/porting-account-cash.md` bagian Keputusan untuk alasan grup ikut porting awal.

## SQL final

```sql
CREATE TABLE account_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama grup, bebas (mis. "Rekening Bank", "Dompet Digital"). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- Sengaja **tanpa** `deleted_at`/`sync_source` — desktop punya kedua kolom ini untuk soft-delete & sync Worker, tapi desktop sendiri tidak memakai `deleted_at` (hard delete murni) dan `sync_source` ditunda sampai semua porting lokal tipe akun selesai.
- `accounts.group_id` FK ke tabel ini dengan `ON DELETE SET NULL` — grup dihapus, akun di dalamnya jadi "Tanpa Grup", bukan ikut terhapus.

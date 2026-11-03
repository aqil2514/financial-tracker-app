
# Tabel `account_groups`

Label pengelompokan bebas untuk akun — murni untuk mengelompokkan tampilan (mis. accordion per grup di list akun), tidak membawa makna/logic finansial apa pun sendiri. Akun tanpa grup ("Tanpa Grup") tetap valid.

Dibuat di migrasi `0005_accounts.ts`, bersamaan dengan `accounts` (lihat [account.md](account.md)) — lihat `docs/todos/done/porting-account-cash.md` bagian Keputusan untuk alasan grup ikut porting awal dan cara grup dikelola dari dalam halaman Akun (tidak ada menu/halaman "Grup Akun" terpisah seperti desktop).

Tidak ada CRUD khusus untuk tabel ini di luar `accounts` — create/edit/delete grup selalu lewat `AccountForm` (`kind: "group"`) yang sama dipakai untuk akun, reusable di halaman Akun (FAB "+"), header accordion (ikon pensil), dan `AccountPickerSheet` di form transaksi (tombol "+ Grup").

## SQL final

```sql
CREATE TABLE account_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama grup, bebas (mis. "Rekening Bank", "Dompet Digital"). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah (UTC, `YYYY-MM-DD HH:mm:ss`), dasar pembanding last-write-wins untuk sync. Ditambahkan di `0011`, di-backfill dari `created_at`. Diisi otomatis trigger (INSERT tanpa nilai, UPDATE yang tidak menyentuhnya); hasil pull menulisnya eksplisit. Lihat [cloud-sync.md](cloud-sync.md). |

## Catatan

- Sengaja **tanpa** `deleted_at`/`sync_source`: mobile hard-delete (penghapusan diberitahukan ke cloud lewat antrean `delete`, lihat [cloud-sync.md](cloud-sync.md)), dan `sync_source` diturunkan Worker dari token, bukan kolom lokal.
- `accounts.group_id` FK ke tabel ini dengan `ON DELETE SET NULL` — grup dihapus, akun di dalamnya jadi "Tanpa Grup", bukan ikut terhapus. **Penting**: ini butuh `PRAGMA foreign_keys = ON` aktif di koneksi SQLite yang sedang dipakai — pragma ini per-koneksi, bukan persisten ke file DB, jadi `migrate.ts` men-set-nya ulang di setiap `onInit` (bug pernah terjadi karena awalnya cuma di-set sekali di migrasi `0002`, lihat `docs/todos/done/porting-account-cash.md` untuk detail).

# Tabel `accounts`

Dompet/akun finansial tempat uang disimpan atau mengalir (kas, rekening bank, dompet digital, piutang/utang, investasi, dana pihak ketiga, dll). Satu tabel dipakai bersama untuk semua tipe akun (`cash`, `debt`, `investment`, `third_party`) — field yang hanya relevan untuk tipe tertentu ada di tabel turunan terpisah yang mereferensikan `accounts(id)` (`debt_accounts`, `investment_accounts`, `third_party_funds`). Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) untuk konsep lengkap kenapa tipe ini ada dan konsekuensinya.

## SQL final

```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
    color TEXT,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_accounts_group ON accounts(group_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama akun (mis. "Dompet", "BCA"). |
| `icon` | TEXT | tidak | NULL | Identifier ikon, aktif dipakai di UI, disimpan terpisah dari `name`. |
| `initial_balance` | REAL | ya | 0 | Saldo awal akun sebelum ada transaksi apa pun. Basis hitungan saldo berjalan — lihat bagian Catatan. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `group_id` | TEXT | tidak | NULL | FK ke `account_groups(id)`. `ON DELETE SET NULL` — grup dihapus, akun jadi "Tanpa Grup", bukan ikut terhapus. |
| `description` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `is_active` | INTEGER | ya | 1 | Boolean (0/1), menandai akun aktif/nonaktif. |
| `account_type` | TEXT | ya | `cash` | `cash`, `debt`, `investment`, atau `third_party` — dibatasi `CHECK`. Menentukan fitur apa yang relevan untuk akun ini (lihat konsep-tipe-akun.md). **Terkunci** begitu akun pernah dipakai transaksi — tidak bisa diubah lagi lewat form edit setelah itu. |
| `color` | TEXT | tidak | NULL | Value warna langsung (mis. hex), aktif dipakai di UI, tidak butuh mapping. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. Auto-terisi oleh trigger `trg_accounts_updated_at` kalau statement `UPDATE` tidak menyetelnya sendiri — lihat Catatan. Bagian dari mekanisme sinkronisasi cloud Worker/MCP, lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) untuk konteks. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker — baris tidak langsung hard delete, cuma ditandai terhapus di waktu ini. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir, dipakai logic sinkronisasi cloud Worker/MCP untuk tahu baris ini datang dari mana. |

## Catatan

- **Tidak ada kolom saldo tersimpan.** Saldo berjalan selalu dihitung on-the-fly: `balance = initial_balance + SUM(income) - SUM(expense) - SUM(transfer keluar) + SUM(transfer masuk)`, dari tabel `transactions` dikelompokkan per `account_id`/`transfer_account_id` dan `type`.
- `account_type` terkunci begitu akun pernah dipakai transaksi — form edit tidak lagi mengizinkan perubahan tipe setelah itu (lihat konsep-tipe-akun.md bagian "Mengubah tipe akun yang salah pilih di awal").
- Tabel turunan per tipe akun masing-masing `REFERENCES accounts(id)`: `debt_accounts` untuk tipe `debt`, `investment_accounts` untuk tipe `investment`, `third_party_funds` untuk tipe `third_party` — masing-masing akan didokumentasikan di file terpisah.
- `deleted_at` dan `sync_source` ada untuk mendukung soft-delete dan sinkronisasi cloud Worker/MCP, lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) untuk konteks penggunaannya.
- Trigger `trg_accounts_updated_at` (`AFTER UPDATE ... WHEN NEW.updated_at = OLD.updated_at`) menimpa `updated_at` dengan `datetime('now')` setiap kali baris di-`UPDATE` TANPA aplikasi menyetel `updated_at` secara eksplisit di statement itu — jadi kolom ini terisi otomatis selama caller tidak sudah mengisinya sendiri (mis. saat backfill/sync yang sengaja menyetel timestamp tertentu).
- Lihat juga [account-group.md](account-group.md) untuk tabel grup yang direferensikan `group_id`.

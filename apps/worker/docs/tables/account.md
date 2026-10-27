# Tabel `accounts`

Dompet/akun finansial, di-sync dari desktop ke D1 lewat Worker. Peran tabel ini di worker murni sebagai **target sinkronisasi cloud** — baris di sini adalah salinan hasil sync dari `apps/desktop`, dibaca juga oleh MCP server untuk keperluan tool-tool MCP. Satu tabel dipakai bersama untuk semua tipe akun (`cash`, `debt`, `investment`, `third_party`); field yang hanya relevan untuk tipe tertentu ada di tabel turunan terpisah yang mereferensikan `accounts(id)` (`debt_accounts`, `investment_accounts`, `third_party_funds`). Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) untuk konsep lengkap tipe akun — dokumen itu menjelaskan sudut pandang desktop, bukan khusus worker.

## SQL final

```sql
CREATE TABLE accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    initial_balance REAL NOT NULL DEFAULT 0,
    group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
    color TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_accounts_group ON accounts(group_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, sama dengan `id` baris asal di desktop (UUID). |
| `name` | TEXT | ya | - | Nama akun, disalin apa adanya dari desktop. |
| `icon` | TEXT | tidak | NULL | Identifier ikon, disalin dari desktop. |
| `initial_balance` | REAL | ya | 0 | Saldo awal akun sebelum ada transaksi apa pun. |
| `group_id` | TEXT | tidak | NULL | FK ke `account_groups(id)`. `ON DELETE SET NULL` — grup dihapus, akun jadi "Tanpa Grup", bukan ikut terhapus. |
| `description` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `is_active` | INTEGER | ya | 1 | Boolean (0/1), menandai akun aktif/nonaktif. |
| `account_type` | TEXT | ya | `cash` | `cash`, `debt`, `investment`, atau `third_party` — dibatasi `CHECK`. Menentukan tabel turunan mana (kalau ada) yang relevan untuk akun ini. |
| `color` | TEXT | tidak | NULL | Value warna langsung (mis. hex). **Ada** di D1, sama seperti desktop — bukan kolom yang hilang saat sync. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada `DEFAULT (datetime('now'))`** di D1 (beda dari desktop yang punya default ini) — nilai wajib dikirim eksplisit oleh pemanggil (kode sync Worker/MCP), kalau tidak `INSERT` akan gagal karena kolom ini `NOT NULL` tanpa default. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah. **Harus diisi manual oleh kode TypeScript Worker setiap kali melakukan `UPDATE`** — lihat Catatan. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker — baris tidak langsung hard delete, cuma ditandai terhapus di waktu ini. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir yang diterima Worker, dipakai logic sync untuk resolusi konflik. |

## Catatan

- **Tidak ada trigger apa pun di D1** (sudah diverifikasi lewat `sqlite_master WHERE type='trigger'` — hasilnya kosong). Ini beda total dari desktop yang punya 17 trigger auto-update `updated_at`. Konsekuensinya: setiap endpoint/handler Worker yang melakukan `UPDATE` ke tabel ini **wajib menyetel `updated_at` secara eksplisit di statement-nya sendiri** — tidak ada mekanisme DB-level yang menimpanya otomatis seperti di desktop (`trg_accounts_updated_at`).
- `created_at` di D1 **tidak** punya `DEFAULT (datetime('now'))`, beda dari desktop yang punya default ini. Kode Worker yang insert baris baru (lewat sync dari desktop atau lewat tool MCP) wajib mengisi `created_at` sendiri.
- Verifikasi baris-per-baris terhadap skema desktop: semua kolom desktop (`id`, `name`, `icon`, `initial_balance`, `group_id`, `description`, `is_active`, `account_type`, `color`, `created_at`, `updated_at`, `deleted_at`, `sync_source`) **ada** di D1, tidak ada yang hilang. Sebaliknya juga tidak ada kolom tambahan di D1 yang tidak ada di desktop — urutan fisik kolom sedikit berbeda (`created_at` diletakkan setelah `color` di D1, bukan di awal seperti desktop) tapi ini tidak berpengaruh secara fungsional.
- **Tidak ada kolom saldo tersimpan**, sama seperti desktop. Tapi D1 tidak otomatis menghitung saldo berjalan sendiri — itu tanggung jawab pembaca data (desktop/MCP), Worker cuma menyimpan baris transaksi hasil sync.
- Tabel turunan per tipe akun (`debt_accounts`, `investment_accounts`, `third_party_funds`) juga ikut di-sync ke D1, masing-masing `REFERENCES accounts(id)` — tidak dibahas detail di dokumen ini.
- `deleted_at` dan `sync_source` dipakai mekanisme soft-delete dan resolusi sync Worker/MCP — detail mekanisme sync-nya sendiri tidak dibahas di dokumen ini.
- Lihat juga [account-group.md](account-group.md) untuk tabel grup yang direferensikan `group_id`.

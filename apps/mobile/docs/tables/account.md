
# Tabel `accounts`

Dompet/akun finansial tempat uang disimpan atau mengalir (kas, rekening bank, dompet digital, dll). Satu tabel dipakai bersama untuk semua tipe akun (`cash`, `debt`, `investment`, `third_party`) — field yang hanya relevan untuk tipe tertentu ada di tabel turunan terpisah yang mereferensikan `accounts(id)` (belum ada di mobile, masih fase tipe `cash`). Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) dan `docs/todos/done/porting-account-cash.md` (porting tipe `cash` sudah selesai).

Dibuat di migrasi `0005_accounts.ts`.

## SQL final

```sql
CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  initial_balance REAL NOT NULL DEFAULT 0,
  account_type TEXT NOT NULL DEFAULT 'cash' CHECK (account_type IN ('cash', 'debt', 'investment', 'third_party')),
  group_id TEXT REFERENCES account_groups(id) ON DELETE SET NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_accounts_group ON accounts(group_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama akun (mis. "Dompet", "BCA"). |
| `icon` | TEXT | tidak | NULL | **Aktif dipakai** (beda dari `categories.icon` yang mati) — identifier ikon Lucide (mis. `Wallet`, `Banknote`), disimpan terpisah dari `name` (bukan ditempel sebagai emoji). Mapping nama→komponen render RN lewat `lucide-react-native` ada di `src/lib/account-icons.ts`, picker UI-nya di `IconPickerField` — lihat `docs/todos/done/porting-account-cash.md` bagian Keputusan #4. |
| `color` | TEXT | tidak | NULL | **Aktif dipakai**. Value nama warna dari whitelist terbatas (mis. `slate`, `green`), bukan hex bebas — lookup className/hex ada di `src/lib/account-colors.ts`. |
| `initial_balance` | REAL | ya | 0 | Saldo awal akun sebelum ada transaksi apa pun. Basis hitungan saldo berjalan — lihat bagian Catatan. |
| `account_type` | TEXT | ya | `cash` | `cash`, `debt`, `investment`, atau `third_party` — dibatasi `CHECK`. **Terkunci** begitu akun pernah dipakai transaksi (tidak bisa diubah lagi lewat form edit). |
| `group_id` | TEXT | tidak | NULL | FK ke `account_groups(id)`. `ON DELETE SET NULL` — grup dihapus, akun jadi "Tanpa Grup". |
| `description` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `is_active` | INTEGER | ya | 1 | Boolean (0/1). Field biasa di form edit (bukan quick-toggle seperti dot status kategori). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- **Tidak ada kolom saldo tersimpan.** Saldo berjalan selalu dihitung on-the-fly: `initial_balance + SUM(income) - SUM(expense) - SUM(transfer keluar dari akun ini) + SUM(transfer masuk ke akun ini)`, dari tabel `transactions` dikelompokkan per `account_id`/`transfer_account_id`. Rumus ini **wajib direplikasi persis** sama seperti desktop/worker, bukan diturunkan ulang secara independen — lihat `docs/todos/done/porting-account-cash.md` bagian Saldo untuk SQL lengkapnya, diimplementasikan di `src/features/accounts/content/use-accounts.ts`.
- Sengaja **tanpa** `deleted_at`/`sync_source` dibanding skema desktop — lihat [account-group.md](account-group.md) untuk alasannya (sama, berlaku untuk kedua tabel).
- Menghapus akun yang masih dipakai transaksi mewajibkan pilihan eksplisit "unassign" (set `account_id`/`transfer_account_id` transaksi terkait jadi NULL) atau "reassign" (pindah ke akun lain) lebih dulu — delete sendiri tetap hard delete.
- `transactions.account_id`/`transfer_account_id` **masih free-text tanpa FK** ke tabel ini (beda dari `transactions.category_id` yang sudah FK ke `categories` lewat `0004_transaction_category_fk.ts`) — tapi sejak `AccountPickerSheet` (lihat `docs/todos/done/porting-account-cash.md`), nilainya selalu valid UUID `accounts.id` secara praktik, FK formal belum ditambahkan. Lihat [transaction.md](transaction.md).
- **Koreksi saldo ("Balance Correction")**: mengubah field "Saldo Terkini" di form edit akun (`app/accounts/[id]/edit.tsx`) men-trigger insert transaksi penutup ke `transactions` (kategori otomatis "Penyesuaian Saldo", `is_cash_neutral` ditentukan dari jawaban Alert "Hitung sebagai kas riil?") — bukan UPDATE kolom apa pun di tabel ini. Lihat `docs/todos/done/porting-account-cash.md` bagian Keputusan #7 dan `src/features/accounts/correct-account-balance.ts`.

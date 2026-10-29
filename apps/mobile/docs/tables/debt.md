
# Tabel `debt_accounts`, `debts`, `debt_payments`

Tiga tabel yang satu kesatuan siklus hidup utang-piutang, mendampingi akun bertipe `debt` di [account.md](account.md). `debt_accounts` menyimpan arah (piutang/utang) satu akun debt; `debts` mencatat pokok piutang/utang (lahir dari transaksi); `debt_payments` mencatat cicilan/pelunasannya. Lihat [konsep-tipe-akun.md](../../../../docs/concept/konsep-tipe-akun.md) dan [konsep-utang-piutang.md](../../../../docs/concept/konsep-utang-piutang.md) untuk aturan bisnisnya, dan [porting-account-debt.md](../todos/plan/porting-account-debt.md) untuk riset porting dari desktop.

Ketiga tabel dibuat di migrasi `0008_debts.ts`.

## SQL final

```sql
CREATE TABLE debt_accounts (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('receivable', 'payable'))
);

CREATE TABLE debts (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receivable', 'payable')),
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'paid', 'written_off')),
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debts_contact_id ON debts(contact_id);
CREATE INDEX idx_debts_status ON debts(status);

CREATE TABLE debt_payments (
  id TEXT PRIMARY KEY NOT NULL,
  debt_id TEXT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  note TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_debt_payments_debt ON debt_payments(debt_id);
```

## Kolom

### `debt_accounts`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key SEKALIGUS foreign key ke `accounts(id)` — relasi 1:1, satu baris per akun bertipe `debt`. `ON DELETE CASCADE` — akun dihapus, baris arah ini ikut terhapus. |
| `direction` | TEXT | ya | - | `receivable` (Piutang — akun ini mencatat uang yang dipinjamkan ke orang lain) atau `payable` (Utang — uang yang dipinjam dari orang lain), dibatasi `CHECK`. **Tidak ada opsi `both`** — satu akun = satu arah murni, konsisten dengan desain final desktop. **Wajib diisi** saat akun bertipe `debt` dibuat/diedit; akun debt tanpa baris ini di tabel ini ditolak dipakai transaksi. |

### `debts`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `type` | TEXT | ya | - | `receivable` atau `payable`, dibatasi `CHECK` — arah piutang/utang ini (biasanya sama dengan `direction` akun debt yang melahirkannya). |
| `contact_id` | TEXT | tidak | NULL | FK ke `contacts(id)`. `ON DELETE SET NULL` — kontak dihapus, riwayat piutang/utang tetap ada, cuma kehilangan tautan nama. |
| `amount` | REAL | ya | - | Nominal pokok piutang/utang, selalu positif. **Sisa belum lunas (`remaining`) tidak disimpan di sini** — lihat bagian Catatan. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)` (akun debt tempat piutang/utang ini tercatat). `ON DELETE SET NULL`. Nullable murni mengikuti skema desktop (dipakai untuk baris sync Retailku yang tidak relevan di mobile) — jalur kode mobile sendiri **selalu** mengisinya. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)` — transaksi yang melahirkan piutang/utang ini. `ON DELETE SET NULL` (bukan CASCADE) — menghapus transaksi pokok TIDAK menghapus baris `debts` ini, nominal/status tetap sama, cuma kehilangan tautan "lahir dari transaksi mana". |
| `status` | TEXT | ya | `ongoing` | `ongoing`, `paid`, atau `written_off`, dibatasi `CHECK`. `ongoing→paid` ditentukan oleh logic alokasi FIFO saat pelunasan (bukan trigger/computed column). `written_off` dipakai untuk kasus bukan pelunasan penuh (mis. diikhlaskan). |
| `note` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `date` | TEXT | ya | - | Tanggal LAHIR piutang/utang ini (dipakai sebagai urutan FIFO pelunasan, bukan tanggal bayar). |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

### `debt_payments`

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `debt_id` | TEXT | ya | - | FK ke `debts(id)`. `ON DELETE CASCADE` — baris `debts` dihapus (jarang terjadi, lihat Catatan di [debt.md](debt.md) soal delete transaksi), riwayat cicilannya ikut terhapus. |
| `amount` | REAL | ya | - | Nominal alokasi pembayaran untuk `debt_id` ini, selalu positif. Satu transaksi pelunasan bisa melahirkan beberapa baris di sini (satu per `debts` yang kebagian alokasi FIFO), semua menunjuk `transaction_id` yang sama. |
| `account_id` | TEXT | tidak | NULL | FK ke `accounts(id)` — akun kas yang dipakai membayar (atau akun debt itu sendiri untuk pelunasan non-cash). `ON DELETE SET NULL`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)` — transaksi pelunasan. `ON DELETE SET NULL` (bukan CASCADE), sama alasannya seperti `debts.transaction_id`. |
| `note` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `date` | TEXT | ya | - | Tanggal pembayaran/cicilan ini terjadi. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- Ketiga tabel ini sengaja **tanpa** `updated_at`/`deleted_at`/`sync_source` (infrastruktur cloud-sync desktop↔worker) dan **tanpa** `source`/`source_ref` (integrasi Retailku, tidak relevan di mobile) dibanding skema final desktop — sama seperti keputusan [account.md](account.md)/[account-group.md](account-group.md), ditunda sampai semua porting lokal tipe akun selesai dan putaran sync dibahas ulang.
- **`remaining` (sisa belum lunas suatu `debts`) tidak disimpan sebagai kolom** — selalu dihitung `amount - COALESCE(SUM(debt_payments.amount), 0)` dikelompokkan per `debt_id`. Fragment SQL ini **wajib satu sumber kebenaran**, jangan diduplikasi manual di banyak tempat (list, alokasi FIFO, validasi) — desktop pernah mengalami bug nyata karena fragment ini di-copy-paste dan salah satu kopiannya lupa filter soft-delete. Mobile otomatis lebih sederhana karena `debt_payments` di sini tidak punya `deleted_at`.
- **Saldo akun debt** ikut rumus on-the-fly yang sama seperti akun `cash` (lihat [account.md](account.md)) — tidak ada kolom saldo terpisah, akun debt otomatis ikut terhitung lewat `transactions.account_id`/`transfer_account_id` yang sudah ada.
- **Dua jalur pembuatan/perubahan `debts`**: Jalur 1 — transfer kas↔akun debt (arah lahir/lunas dibaca dari `debt_accounts.direction`); Jalur 2 — income/expense langsung di akun debt tanpa kas berpindah. Detail lengkap kombinasi dan alokasi FIFO ada di [porting-account-debt.md](../todos/plan/porting-account-debt.md).
- **Balance Correction dilarang** untuk akun bertipe `debt` — beda dari akun `cash` yang punya mekanisme Balance Correction (lihat [account.md](account.md) Catatan terakhir). Saldo akun debt adalah agregasi dari banyak baris `debts` milik kontak-kontak berbeda, jadi koreksi 1 angka per akun tidak tahu kontak/debt mana yang salah — koreksi granular per-baris `debts` (`debt_amount_adjustments`) masih kandidat di luar MVP.
- Lihat juga [contact.md](contact.md) dan [account.md](account.md) untuk tabel yang berelasi langsung ke tabel-tabel ini.

# Skema sync mobile: `cloud_sync_state`, `cloud_sync_queue`, `cloud_sync_rejected_log`, dan perubahan di tabel data

> **STATUS:** migrasi `0011`, `0012`, dan `0013` SUDAH ADA dan teruji dengan SQLite asli (`cloud-sync-triggers.test.ts`, `local-datetime-format.test.ts`). Format `date` sudah diseragamkan: kode memakai `src/lib/utils/local-datetime.ts`, dan `0013` mengonversi baris lama. `transactions.contact_id` sudah diisi dari form transaksi (tambah dan edit), dan dokumen per-tabel sudah memuat kolom baru. SQL di bawah adalah rancangan; sumber kebenaran adalah file migrasinya.

Infrastruktur sinkronisasi mobile ↔ Worker ↔ desktop, meniru pola desktop ([cloud-sync.md desktop](../../../desktop/docs/tables/cloud-sync.md)): antrean outbox untuk push, log penolakan, dan penanda checkpoint untuk pull. Bedanya dari desktop, antrean diisi oleh trigger SQLite (bukan panggilan `pushOnWrite` manual), dan mobile hard-delete di semua tempat sehingga tidak ada kolom `deleted_at` lokal.

Migrasi (satu file per versi, didaftarkan di `src/lib/database/migrations/index.ts`, lihat memori pola migrasi mobile):

1. `0011_sync_updated_at.ts` — kolom `updated_at` di tabel data + backfill + trigger `updated_at`, kolom `transactions.contact_id`, penyeragaman format `date`.
2. `0012_cloud_sync.ts` — `cloud_sync_state`, `cloud_sync_queue`, `cloud_sync_rejected_log`, dan trigger antrean.

## Tabel `cloud_sync_state`

Satu baris tunggal: URL Worker, checkpoint pull, dan penanda "sedang menerapkan hasil pull". Token TIDAK disimpan di sini, tapi di `expo-secure-store`.

### SQL final

```sql
CREATE TABLE cloud_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  worker_url TEXT,
  checkpoint TEXT,
  attachment_checkpoint TEXT,
  applying_pull INTEGER NOT NULL DEFAULT 0 CHECK (applying_pull IN (0, 1))
);

INSERT INTO cloud_sync_state (id) VALUES (1);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | INTEGER | ya | - | Selalu `1` (dibatasi `CHECK`), memastikan tabel ini cuma punya satu baris. |
| `worker_url` | TEXT | tidak | NULL | URL dasar Worker. NULL berarti sync belum dikonfigurasi, dan semua pemicu sync jadi no-op. |
| `checkpoint` | TEXT | tidak | NULL | Nilai `checkpoint` dari respons `GET /sync` terakhir yang sukses diterapkan seluruhnya. NULL berarti pull berikutnya snapshot penuh (tanpa `since`). Hanya maju setelah SELURUH apply sukses. |
| `attachment_checkpoint` | TEXT | tidak | NULL | Checkpoint terpisah untuk attachment (R2), dipakai di Fase 5. |
| `applying_pull` | INTEGER | ya | 0 | Penanda gema: `1` selama fungsi apply pull berjalan, sehingga trigger antrean tidak mencatat baris hasil pull untuk dikirim balik. Wajib diset `1` dan dikembalikan `0` dalam blok `try/finally` (kalau crash di tengah, app harus me-reset ke `0` saat start). |

### Catatan

- Rekomendasi di rencana awal menyebut tabel `settings` umum; di sini dipilih satu baris bertipe kolom karena trigger perlu membaca `applying_pull` dengan `SELECT` sederhana dan murah.
- Token (`PC_SYNC_TOKEN`) disimpan di `expo-secure-store`, bukan di tabel ini, supaya tidak ikut terbaca lewat dump/backup SQLite.

## Tabel `cloud_sync_queue`

Outbox push. Satu entry per baris sumber yang menunggu dikirim ke Worker.

### SQL final

```sql
CREATE TABLE cloud_sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL CHECK (
    table_name IN (
      'account_groups', 'categories', 'contacts', 'accounts',
      'transactions', 'debts', 'debt_payments',
      'investment_accounts', 'investment_purchases', 'investment_sales',
      'category_periods', 'third_party_funds',
      'transaction_attachments', 'labels'
    )
  ),
  row_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload TEXT,
  UNIQUE (table_name, row_id)
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | INTEGER | ya | autoincrement | Nomor urut antrean. Pemroses mengurutkan menurut urutan FK tabel dulu (grup/kategori/kontak → akun → transaksi → debts/investasi/third-party → payments/attachments), baru `id`. |
| `table_name` | TEXT | ya | - | Tabel sumber, dibatasi `CHECK` ke tabel yang punya endpoint push di Worker. `labels` ditambahkan di `0016_labels_sync.ts`; tabel junction label (`*_labels`) belum ada. |
| `row_id` | TEXT | ya | - | ID baris sumber. Untuk `investment_accounts` isinya `account_id` (primary key tabel itu), untuk `category_periods` isinya `id` periode. |
| `op` | TEXT | ya | - | `upsert` atau `delete`. |
| `attempts` | INTEGER | ya | 0 | Jumlah percobaan kirim yang gagal (jaringan/5xx). Direset ke 0 tiap kali baris berubah lagi. |
| `last_error` | TEXT | tidak | NULL | Pesan error percobaan terakhir. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu entry pertama dibuat. |
| `payload` | TEXT | tidak | NULL | JSON opsional, khusus `op = 'delete'`: opsi body DELETE (`transactionAction`, `memberAction`, `childAction`, target reassign). NULL berarti body kosong (default Worker: `unassign`). Untuk `upsert`, payload SELALU dibaca ulang dari baris sumber saat kirim, bukan dari kolom ini. |

### Catatan

- `UNIQUE (table_name, row_id)`: edit berulang menggantikan entry lama lewat `INSERT ... ON CONFLICT DO UPDATE` di trigger, bukan menumpuk. Hapus setelah edit mengubah `op` jadi `delete`.
- Entry `delete` untuk baris yang tidak pernah sampai ke cloud menghasilkan 404 dari Worker; 404 diperlakukan sukses (idempotent), jadi entry tidak macet.
- Tidak ada FK ke tabel sumber (`table_name` dinamis), sama seperti desktop.
- Tidak ada endpoint DELETE untuk `investment_accounts` maupun `debt_accounts`, jadi keduanya tidak punya entry `delete` di antrean. Worker hanya me-soft-delete baris `accounts` (`deleteAccount`), sedangkan baris `investment_accounts`/`debt_accounts` dibiarkan; itu aman karena tersembunyi di balik akun yang sudah `deleted_at`. Trigger `DELETE` pada `debt_accounts`/`investment_accounts` tetap me-enqueue upsert (dijaga agar tidak membalik delete), jadi pemroses antrean harus menganggap baris sumber yang sudah tidak ada sebagai selesai.
- Daftar `CHECK` baru perlu migrasi copy-and-rename kalau ditambah tabel sync baru, seperti `0016_labels_sync.ts`. Selama rename, `PRAGMA legacy_alter_table = ON` wajib menyala: trigger tabel lain merujuk `cloud_sync_queue` yang sesaat tidak ada, dan rename normal menolaknya.

## Tabel `cloud_sync_rejected_log`

### SQL final

```sql
CREATE TABLE cloud_sync_rejected_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('push', 'pull')),
  reason TEXT NOT NULL,
  rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (table_name, row_id, direction)
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | INTEGER | ya | autoincrement | Nomor urut log. |
| `table_name` | TEXT | ya | - | Tabel sumber baris yang ditolak/gagal diterapkan. |
| `row_id` | TEXT | ya | - | ID baris tersebut. |
| `direction` | TEXT | ya | - | `push` (Worker membalas 422) atau `pull` (apply lokal gagal, mis. FOREIGN KEY, NOT NULL). Kolom ini TIDAK ada di desktop; ditambahkan karena bug 2026-10-22 menunjukkan apply pull yang gagal wajib meninggalkan jejak, bukan ditelan `catch {}` kosong. |
| `reason` | TEXT | ya | - | Pesan error dari Worker atau dari SQLite. |
| `rejected_at` | TEXT | ya | `datetime('now')` | Waktu dicatat. |

### Catatan

- `UNIQUE (table_name, row_id, direction)`: kejadian berikutnya untuk baris yang sama menimpa entry lama.
- Entry `push` yang ditolak (422) TETAP di `cloud_sync_queue` dengan `attempts` bertambah dan `last_error` berisi `rejected: ...`, sama seperti desktop, dan dicatat di log ini; entry baru hilang setelah push berikutnya sukses (log ikut dibersihkan) atau barisnya dihapus.
- Checkpoint pull TIDAK boleh maju kalau ada apply `pull` yang gagal pada putaran itu, supaya baris yang gagal akibat parent belum ada bisa dicoba lagi pada pull berikutnya.

## Perubahan di tabel data (migrasi `0011`)

Tabel yang di-sync mendapat `updated_at` agar LWW bisa dibandingkan. `ALTER TABLE ADD COLUMN` SQLite tidak mengizinkan default non-konstan (`datetime('now')`), sehingga kolom ditambah nullable, di-backfill dari `created_at`, lalu dijaga trigger (pola yang sama dengan desktop 0028).

| Tabel | Perubahan | Catatan |
|---|---|---|
| `account_groups`, `categories`, `contacts`, `accounts`, `transactions`, `debts`, `debt_payments`, `investment_purchases`, `investment_sales`, `third_party_funds`, `category_periods` | `ADD COLUMN updated_at TEXT`, backfill `UPDATE ... SET updated_at = created_at` | Nullable di skema (mengikuti desktop/D1), tapi trigger menjamin selalu terisi. |
| `investment_accounts` | Tidak ada kolom baru | Sudah punya `updated_at NOT NULL DEFAULT (datetime('now'))` dari `0009`. Mendapat trigger update seperti lainnya, tapi hati-hati: `update-market-value.ts` sudah mengisinya manual, dan trigger hanya menimpa kalau nilainya tidak berubah. |
| `transactions` | `ADD COLUMN contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL`, index `idx_transactions_contact_id` | Diputuskan 2026-11-04. Mencegah push dari HP menimpa `contact_id` di D1 jadi null. Form transaksi mengisinya dari kontak yang sama yang dipakai membuat debts. Kolom FK lewat `ALTER TABLE ADD COLUMN ... REFERENCES` diperbolehkan SQLite selama defaultnya NULL. |
| `debt_accounts`, `category_period_categories`, `transaction_attachments` | Tidak ada kolom `updated_at` | `debt_accounts.direction` ikut dikirim di payload `/accounts`; pivot kategori periode ikut dikirim di payload `/category-periods/push`; attachment tidak pernah diedit (lihat Fase 5). Perubahan pada tabel-tabel ini cuma meng-enqueue baris induknya. |
| Semua kolom tanggal (`transactions.date`, `debts.date`, `debt_payments.date`, `investment_purchases.date`, `investment_sales.date`, `third_party_funds.date`, `category_periods.start_date`/`end_date`) | Format disamakan dengan desktop: waktu lokal `YYYY-MM-DDTHH:mm` | Diputuskan 2026-11-04. Data HP kosong, jadi tidak ada konversi data lama; yang diubah adalah kode yang menghasilkan tanggal (`new Date().toISOString()` di form dan `form-field-date.tsx`). Periode kategori memakai tanggal saja `YYYY-MM-DD` (sama dengan desktop, dicek di `use-create-category-period.ts`), bukan tanggal-jam. Baris lama dikonversi oleh migrasi `0013_local_datetime_format.ts`. |
| `transactions`, dll. | TIDAK menambah `source`, `source_ref`, `deleted_at`, `sync_source` | `source`/`source_ref` hanya Retailku (diabaikan saat pull), `deleted_at` tidak perlu karena hard-delete lokal, `sync_source` diturunkan Worker dari token. |

## Trigger

Tiga keluarga trigger per tabel tersinkron. Semua ditulis dalam bentuk satu template per tabel di migrasi; contoh untuk `transactions` (tabel lain identik, ganti nama tabel dan `row_id`):

```sql
-- 1) updated_at otomatis (INSERT tanpa nilai, dan UPDATE yang tidak mengubah updated_at)
CREATE TRIGGER trg_transactions_updated_at_ins
AFTER INSERT ON transactions
FOR EACH ROW WHEN NEW.updated_at IS NULL
BEGIN
  UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER trg_transactions_updated_at_upd
AFTER UPDATE ON transactions
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE transactions SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 2) antrean push, dilewati kalau sedang apply pull
CREATE TRIGGER trg_transactions_queue_ins
AFTER INSERT ON transactions
FOR EACH ROW WHEN (SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO cloud_sync_queue (table_name, row_id, op)
  VALUES ('transactions', NEW.id, 'upsert')
  ON CONFLICT (table_name, row_id) DO UPDATE SET op = 'upsert', attempts = 0, last_error = NULL;
END;

CREATE TRIGGER trg_transactions_queue_upd
AFTER UPDATE ON transactions
FOR EACH ROW WHEN (SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO cloud_sync_queue (table_name, row_id, op)
  VALUES ('transactions', NEW.id, 'upsert')
  ON CONFLICT (table_name, row_id) DO UPDATE SET op = 'upsert', attempts = 0, last_error = NULL;
END;

CREATE TRIGGER trg_transactions_queue_del
AFTER DELETE ON transactions
FOR EACH ROW WHEN (SELECT applying_pull FROM cloud_sync_state WHERE id = 1) = 0
BEGIN
  INSERT INTO cloud_sync_queue (table_name, row_id, op)
  VALUES ('transactions', OLD.id, 'delete')
  ON CONFLICT (table_name, row_id) DO UPDATE SET op = 'delete', attempts = 0, last_error = NULL;
END;
```

### Peta trigger antrean per tabel

| Tabel sumber | Antrean (`table_name`, `row_id`) | Delete |
|---|---|---|
| `account_groups`, `categories`, `contacts`, `accounts`, `transactions`, `debts`, `debt_payments`, `investment_purchases`, `investment_sales`, `third_party_funds`, `category_periods` | tabel itu sendiri, `id` | ya |
| `debt_accounts` | `accounts`, `account_id` (direction ikut payload akun) | tidak |
| `investment_accounts` | `investment_accounts`, `account_id` | tidak (tidak ada endpoint) |
| `category_period_categories` | `category_periods`, `period_id` (pivot ikut payload periode) | di-upsert ulang (bukan delete) |
| `transaction_attachments` | `transaction_attachments`, `id` | ya (migrasi `0014`, hanya INSERT dan DELETE karena barisnya tidak pernah diedit) |

### Catatan trigger

- `recursive_triggers` SQLite default OFF, jadi `UPDATE ... SET updated_at` di dalam trigger tidak memicu dirinya sendiri; trigger antrean tetap aktif untuk perubahan itu dan hasilnya idempotent berkat `ON CONFLICT`.
- Cascade FK (`ON DELETE CASCADE`, `SET NULL`) memicu trigger di tabel anak. SUDAH DIUJI dengan SQLite asli (`cloud-sync-triggers.test.ts`), termasuk: hapus akun → anak `investment_*`/`third_party_funds` (CASCADE) masuk antrean sebagai `delete`, dan hapus kontak → `transactions.contact_id`/`debts.contact_id` (SET NULL) masuk antrean sebagai `upsert`. Kalau Worker sudah menangani cascade itu sendiri saat menerima DELETE induk, entry anak yang redundan harus aman (404 = sukses).
- `ON DELETE RESTRICT` di `third_party_funds.contact_id` tetap berlaku; kontak yang masih dipakai tidak bisa dihapus.
- Hasil pull ditulis dengan `updated_at` eksplisit dari cloud, sehingga trigger `updated_at` tidak menimpanya (kondisi `NEW.updated_at IS OLD.updated_at` salah, dan `IS NULL` salah) dan trigger antrean diam karena `applying_pull = 1`.

## Catatan

- Urutan FK dan daftar endpoint push/delete per tabel ada di bagian "Riset: kontrak push dan format" pada [mobile-sync.md](../todos/done/mobile-sync.md).
- Tabel data yang terdampak: [account-group.md](account-group.md), [account.md](account.md), [category.md](category.md), [category-period.md](category-period.md), [contact.md](contact.md), [debt.md](debt.md), [investment.md](investment.md), [third-party-fund.md](third-party-fund.md), [transaction.md](transaction.md), [transaction-attachment.md](transaction-attachment.md).

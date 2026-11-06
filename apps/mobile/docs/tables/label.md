# Tabel `labels`, `transaction_labels`, `category_labels`, `account_labels`

Label adalah tag bebas yang bisa dipasang ke akun, kategori, atau transaksi. `labels` menyimpan kamusnya (CRUD lewat menu Lainnya → Master Data → Label), dan tiga tabel junction menyimpan pemasangannya (many-to-many). `labels` dibuat di `0015_labels.ts`, junction di `0017_label_junctions.ts`. Skema desktop ada di `apps/desktop/docs/tables/label.md`.

## SQL final

```sql
CREATE TABLE labels (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('transaction_category', 'account')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE (name, scope)
);

CREATE INDEX idx_labels_scope ON labels(scope);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama label. Unik per `scope` (`UNIQUE (name, scope)`): dua scope berbeda boleh punya nama sama. Form mobile menolak duplikat tanpa membedakan huruf besar/kecil. |
| `scope` | TEXT | ya | - | `transaction_category` atau `account` (`CHECK`). Menentukan label ini untuk transaksi+kategori atau untuk akun. Dikunci sejak dibuat, form edit tidak mengizinkan ganti scope. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir berubah (UTC, `YYYY-MM-DD HH:mm:ss`). Diisi otomatis trigger `trg_labels_updated_at_ins`/`_upd`, pola yang sama dengan tabel lain di [cloud-sync.md](cloud-sync.md). |

## Catatan

- Sengaja **tanpa** `deleted_at`/`sync_source` dibanding skema desktop, sama seperti [contact.md](contact.md). Delete di mobile adalah hard delete.
- **Ikut sync dua arah** sejak `0016_labels_sync.ts`: trigger antrean `trg_labels_queue_ins/upd/del`, `labels` masuk daftar `CHECK` `cloud_sync_queue`, dan label yang sudah ada saat migrasi di-enqueue sekali. Push lewat `POST /labels` dan `DELETE /labels/:id`; pull menerapkan `labels` dari `GET /sync` (tombstone = hard delete lokal).
- **Bentrok `UNIQUE (name, scope)` saat pull:** label lokal dengan nama+scope sama tapi id berbeda dihapus, versi cloud menang. Pemasangan label lokal itu ikut terhapus lewat `ON DELETE CASCADE` dan dikirim sebagai detach; pemasangan yang sama dari cloud menyusul lewat pull berikutnya hanya kalau memang ada di cloud, jadi pemasangan yang dibuat di HP sebelum sync pertama pada label bentrok bisa hilang.
- Menghapus label (hard delete) ikut menghapus pemasangannya di semua entitas (`ON DELETE CASCADE`), dan tiap pemasangan itu masuk antrean sebagai detach.

## Junction: `transaction_labels`, `category_labels`, `account_labels`

Tiga tabel dengan bentuk identik, hanya kolom entitasnya berbeda. Scope label untuk transaksi dan kategori adalah `transaction_category`, untuk akun adalah `account`.

### SQL final

```sql
CREATE TABLE transaction_labels (
  id TEXT PRIMARY KEY NOT NULL,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE (transaction_id, label_id)
);

CREATE INDEX idx_transaction_labels_entity ON transaction_labels(transaction_id);
CREATE INDEX idx_transaction_labels_label ON transaction_labels(label_id);

-- category_labels: kolom category_id -> categories(id)
-- account_labels:  kolom account_id  -> accounts(id)
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. Bisa diganti id dari cloud saat pull kalau pasangan (entitas, label) yang sama sudah ada di cloud dengan id lain. |
| `transaction_id` / `category_id` / `account_id` | TEXT | ya | - | FK ke entitas. `ON DELETE CASCADE`: entitas dihapus, pemasangan labelnya ikut terhapus. |
| `label_id` | TEXT | ya | - | FK ke `labels(id)`, `ON DELETE CASCADE`. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Pembanding last-write-wins untuk sync, diisi trigger seperti tabel lain. |

### Catatan junction

- `UNIQUE (entitas, label_id)`: satu label tidak bisa terpasang dua kali ke entitas yang sama.
- Tanpa `deleted_at`/`sync_source`: melepas label adalah hard delete. Karena barisnya hilang, trigger `DELETE` menyimpan pasangan (entitas, label) di `cloud_sync_queue.payload` untuk request detach. Lihat [cloud-sync.md](cloud-sync.md).
- Memasang ulang label yang pernah dilepas = INSERT baru (tidak ada baris lama yang perlu dihidupkan). Worker menangani ini lewat pasangan (entitas, label), bukan id.
- Label efektif transaksi dihitung saat query, bukan disimpan: label milik transaksi sendiri, dan kalau kosong, label kategorinya (dipakai filter Label di daftar transaksi, `features/labels/extract-label-condition.ts`).
- Lihat [transaction.md](transaction.md), [category.md](category.md), [account.md](account.md) untuk tabel entitasnya.

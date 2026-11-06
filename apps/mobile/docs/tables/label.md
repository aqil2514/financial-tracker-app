# Tabel `labels`

Kamus label: tag bebas yang nantinya bisa dipasang ke akun, kategori, atau transaksi. Saat ini mobile baru punya kamusnya saja (CRUD lewat menu Lainnya → Master Data → Label); tabel junction `account_labels`, `category_labels`, `transaction_labels` belum ada di mobile, jadi label belum bisa dipasang ke entitas manapun. Dibuat di migrasi `0015_labels.ts`. Skema desktop ada di `apps/desktop/docs/tables/label.md`.

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
- **Belum ikut sync.** Tidak ada trigger antrean dan `labels` belum ada di daftar `table_name` `cloud_sync_queue`, jadi label yang dibuat di mobile hanya lokal dan label dari PC belum masuk. Saat sync ditambahkan, baris yang sudah ada perlu di-enqueue ulang.
- Belum ada tabel junction, jadi menghapus label tidak menyentuh data lain. Saat junction ditambahkan, FK-nya `ON DELETE CASCADE` seperti di desktop.


# Tabel `transaction_attachments`

Menyimpan lampiran (file, biasanya foto struk/bukti) yang ditautkan ke satu transaksi. Satu transaksi bisa punya banyak lampiran — relasi one-to-many dari `transactions` ke tabel ini.

## SQL final

```sql
CREATE TABLE transaction_attachments (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_transaction_attachments_transaction ON transaction_attachments(transaction_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `transaction_id` | TEXT | ya | - | FK ke `transactions(id)`. `ON DELETE CASCADE` — transaksi dihapus, lampirannya ikut terhapus. |
| `file_path` | TEXT | ya | - | Path file lampiran di storage lokal device. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris lampiran ini dibuat. |

## Catatan

- Tidak ada kolom `updated_at`/`deleted_at`/`sync_source` di tabel ini — lampiran tidak soft-delete dan tidak ikut mekanisme sinkronisasi cloud baris-per-baris seperti tabel lain.
- Lihat juga [transaction.md](transaction.md) untuk tabel induknya.

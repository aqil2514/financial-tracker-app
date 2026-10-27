
# Tabel `transaction_attachments`

Menyimpan lampiran (file, biasanya foto struk/bukti) yang ditautkan ke satu transaksi. Satu transaksi bisa punya banyak lampiran — relasi one-to-many dari `transactions` ke tabel ini.

Skema ini dibuat di migrasi `0002` dan ikut di-rebuild (tanpa perubahan kolom) di migrasi `0004` saat `transactions` di-copy-and-rename, karena FK-nya menyimpan nama tabel `transactions` sebagai string literal — lihat `src/lib/database/migrations/0004_transaction_category_fk.ts`.

## SQL final

```sql
CREATE TABLE transaction_attachments (
  id TEXT PRIMARY KEY NOT NULL,
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

- `transactions.has_attachment` adalah flag turunan (bukan dihitung ulang tiap query) yang harus dijaga konsisten secara manual tiap kali baris di tabel ini ditambah/dihapus.
- Lihat juga [transaction.md](transaction.md) untuk tabel induknya.

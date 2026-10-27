# Tabel `contacts`

Mirror cloud dari tabel `contacts` di desktop — identitas pihak (orang/entitas) yang dipakai lintas domain (debts, third_party_funds, transactions) sebagai satu identitas konsisten, bukan teks bebas. Dibuat di `schema/0001_initial.sql` sebagai replika dari desktop pasca migrasi `0028_cloud_sync_columns.sql`. Untuk konsep lengkap kenapa kontak disatukan lintas domain, lihat dokumen desktop `apps/desktop/docs/tables/contact.md` dan `docs/concept/konsep-utang-piutang.md` — worker di sini murni jadi target sinkronisasi, tidak mendefinisikan ulang konsepnya.

## SQL final

```sql
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_contacts_name ON contacts(name);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID v7. Sama persis dengan `id` baris terkait di SQLite lokal desktop — kunci penghubung lintas device. |
| `name` | TEXT | ya | - | Nama kontak, identitas yang dipakai konsisten lintas domain. |
| `note` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT di D1** (terverifikasi dari introspeksi skema production) — beda dari desktop yang punya `DEFAULT (datetime('now'))`. Worker selalu isi eksplisit saat INSERT. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah, dasar resolusi konflik LWW antara PC dan MCP. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — menandai asal penulis terakhir baris ini. |

## Catatan

- **Tidak ada trigger apa pun di D1** (terverifikasi lewat introspeksi `sqlite_master type='trigger'` pada database production — kosong). Desktop punya trigger `trg_contacts_updated_at` yang otomatis menimpa `updated_at` tiap `UPDATE`; di worker, `src/modules/contacts/service.ts` dan `src/modules/sync/service/entities/contacts.ts` WAJIB mengisi `updated_at` secara eksplisit tiap INSERT/UPDATE — tanpa ini, logic LWW (penentuan baris mana yang menang saat PC dan MCP sama-sama mengubah kontak yang sama) tidak punya nilai akurat untuk dibandingkan.
- `created_at` juga tidak punya DEFAULT di D1, konsisten dengan pola "worker selalu isi eksplisit" di seluruh tabel D1 — berbeda dari desktop yang mengandalkan `DEFAULT (datetime('now'))` di kolom ini.
- Skema D1 tabel ini identik strukturnya dengan desktop (kolom, tipe, `CHECK`) — satu-satunya beda nyata adalah mekanisme pengisian `updated_at`/`created_at` (trigger + default di desktop, eksplisit dari kode di worker).
- Lihat juga [transaction.md](transaction.md) untuk relasi `contact_id` di sisi transaksi.

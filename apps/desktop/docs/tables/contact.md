# Tabel `contacts`

Identitas pihak (orang/entitas) yang dicatat sebagai satu entitas konsisten, bukan teks bebas — supaya rangkuman per orang (mis. "si Budi masih utang berapa") tidak pecah gara-gara nama ditulis beda-beda tiap kali. Dibuat di migrasi `0012_debts.sql` (awalnya `INTEGER PRIMARY KEY AUTOINCREMENT`), dimigrasi ulang ke UUID plus kolom sync di `0027_uuid_primary_keys.sql`.

Dipakai bersama oleh dua domain berbeda, bukan dipisah per domain: `debts.contact_id` (siapa yang berutang/memberi utang, nullable) dan `third_party_funds.contact_id` (siapa pemilik dana pihak ketiga, NOT NULL). `transactions.contact_id` juga ada (opsional) — transaksi expense/income biasa bisa sekaligus melahirkan `debts` kalau kontak diisi, detail penuh ada di [transaction.md](transaction.md) dan [debt.md](debt.md).

## SQL final

```sql
CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_contacts_name ON contacts(name);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama kontak. Satu nama = satu identitas yang dipakai konsisten di semua domain (debts, third_party_funds, transactions), bukan ditulis ulang bebas tiap transaksi. |
| `note` | TEXT | tidak | NULL | Catatan tambahan, bebas. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris diubah, bagian mekanisme sinkronisasi cloud. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete marker — baris tidak hard delete, cuma ditandai terhapus di waktu ini. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` (dibatasi `CHECK`) — menandai asal perubahan terakhir untuk logic sinkronisasi cloud. |

## Catatan

- Tabel ini satu-satunya sumber identitas kontak lintas domain — **tidak** ada tabel kontak terpisah per domain. `debts.contact_id` nullable (`ON DELETE SET NULL`, kontak boleh dihapus tanpa menghapus riwayat utang/piutangnya), sedangkan `third_party_funds.contact_id` NOT NULL (`ON DELETE RESTRICT`, kontak wajib ada karena dana pihak ketiga tidak masuk akal tanpa pemilik) — lihat `docs/concept/konsep-dana-pihak-ketiga.md` dan `docs/concept/konsep-utang-piutang.md` bagian "Nama orang dicatat sebagai satu identitas".
- `transactions.contact_id` opsional — form transaksi expense/income biasa yang kontaknya diisi bisa sekaligus membuat `debts` baru, bukan cuma lewat form transfer debt khusus. Detail mekanisme ada di [transaction.md](transaction.md) dan [debt.md](debt.md).
- `updated_at`/`deleted_at`/`sync_source` untuk soft-delete & sinkronisasi cloud Worker/MCP — detail mekanisme sync ada di dokumen lain, di sini sekadar ditandai perannya.
- Trigger `trg_contacts_updated_at` otomatis menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- Lihat juga [transaction.md](transaction.md) untuk relasi `contact_id` di sisi transaksi.

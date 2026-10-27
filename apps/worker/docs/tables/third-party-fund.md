# Tabel `third_party_funds`

Mirror dari tabel desktop `third_party_funds` — riwayat titip/ambil/pindah dana pihak ketiga, baris detail per peristiwa pada akun bertipe `third_party` (satu akun virtual per TEMPAT fisik), dibedakan per penitip lewat `contact_id`. Lihat [konsep-dana-pihak-ketiga.md](../../../../docs/concept/konsep-dana-pihak-ketiga.md) untuk model lengkapnya, dan [third-party-fund.md desktop](../../../desktop/docs/tables/third-party-fund.md) untuk versi sumbernya. Skema di sini diambil langsung dari introspeksi `sqlite_master` D1 production (bukan rekonstruksi migrasi).

## SQL final

```sql
CREATE TABLE third_party_funds (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_third_party_funds_account ON third_party_funds(account_id);
CREATE INDEX idx_third_party_funds_contact ON third_party_funds(contact_id);
CREATE INDEX idx_third_party_funds_transaction ON third_party_funds(transaction_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, akun bertipe `third_party` (tempat fisik titipan disimpan). `ON DELETE CASCADE` — akun dihapus, seluruh riwayat titip/ambil di akun itu ikut terhapus. |
| `contact_id` | TEXT | ya | - | FK ke `contacts(id)`, pihak yang nitip/mengambil. NOT NULL dengan `ON DELETE RESTRICT` — kontak tidak boleh dihapus selama masih punya riwayat dana pihak ketiga. Sama seperti versi desktop. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`. `ON DELETE SET NULL` — transaksi sumber dihapus, baris riwayat ini tetap ada tapi kehilangan tautannya. |
| `direction` | TEXT | ya | - | `in` (dana masuk/titip) atau `out` (dana keluar/ambil), dibatasi `CHECK`. Kolom sendiri (bukan baca `transactions.type`) karena transfer `third_party → third_party` menghasilkan DUA baris per transaksi. |
| `amount` | REAL | ya | - | Nominal dana yang titip/ambil/pindah pada baris ini. |
| `date` | TEXT | ya | - | Tanggal peristiwa. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `created_at` | TEXT | ya | - | Waktu baris dibuat. **Tidak ada DEFAULT** di D1 (beda dari desktop yang punya `DEFAULT (datetime('now'))`) — kode Worker yang insert baris WAJIB mengisi kolom ini secara eksplisit. |
| `updated_at` | TEXT | tidak | NULL | Waktu baris terakhir diubah. **Nullable, tidak ada DEFAULT, dan tidak ada trigger auto-update** di D1 (beda dari desktop yang `NOT NULL DEFAULT (datetime('now'))` + trigger `trg_third_party_funds_updated_at`) — kode TypeScript Worker harus set kolom ini manual setiap kali UPDATE, kalau tidak nilainya tetap NULL/stale. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete. NULL berarti masih aktif. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK` — asal baris ini dibuat/diubah. |

## Catatan

- **Tidak ada trigger sama sekali di D1** (`sqlite_master` type `trigger` kosong) — berbeda dari desktop yang punya `trg_third_party_funds_updated_at` untuk auto-update `updated_at` tiap `UPDATE`. Di Worker, setiap kode yang melakukan `UPDATE` ke tabel ini WAJIB menyertakan `updated_at = datetime('now')` (atau timestamp setara) secara manual — tidak ada jaring pengaman dari skema.
- **`created_at` tidak punya DEFAULT di D1**, berbeda dari desktop. Kode Worker yang melakukan `INSERT` wajib menyertakan nilai `created_at` sendiri, tidak bisa mengandalkan skema untuk mengisi otomatis.
- Struktur kolom selain `created_at`/`updated_at` identik dengan desktop — tidak ada kolom hilang/tambahan lain yang ditemukan.
- Index sama persis dengan desktop: `idx_third_party_funds_account`, `idx_third_party_funds_contact`, `idx_third_party_funds_transaction`.
- Untuk makna bisnis kolom (`direction`, perhitungan sisa titipan, dsb.), lihat [konsep-dana-pihak-ketiga.md](../../../../docs/concept/konsep-dana-pihak-ketiga.md) dan dokumen desktop — tabel ini murni mirror struktural untuk kebutuhan sync cloud, bukan sumber kebenaran konsep.
- Lihat juga [label.md](label.md) untuk domain tabel lain di Worker dengan pola `created_at`/`updated_at` serupa (tanpa DEFAULT, tanpa trigger).

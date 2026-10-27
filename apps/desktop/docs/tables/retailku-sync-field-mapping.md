
# Tabel `retailku_sync_field_mapping` dan `settings`

## Tabel `retailku_sync_field_mapping`

Pemetaan field dari sistem Retailku (sistem POS/warung terpisah, eksternal) ke struktur data lokal aplikasi ini — akun lokal (`local_account_id`, `secondary_account_id`) dan kategori lokal (`category_id`). Dipakai saat data dari sync Retailku masuk, untuk menentukan baris Retailku mana dipetakan ke akun/kategori lokal mana. Dibuat di migrasi `0020_retailku_sync_field_mapping.sql`, kolom `secondary_account_id` ditambahkan di `0023_retailku_sync_field_mapping_secondary_account.sql`, kolom `source_kind` dan `extra_fields` ditambahkan di `0024_retailku_sync_field_mapping_extra_fields.sql`.

### SQL final

```sql
CREATE TABLE retailku_sync_field_mapping (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    retailku_account_id TEXT NOT NULL,
    retailku_account_code TEXT NOT NULL,
    retailku_account_name TEXT NOT NULL,
    local_account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
    note TEXT,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    secondary_account_id TEXT REFERENCES accounts(id) ON DELETE RESTRICT,
    source_kind TEXT NOT NULL DEFAULT 'generic',
    extra_fields TEXT
);

CREATE INDEX idx_retailku_sync_field_mapping_category
    ON retailku_sync_field_mapping(category_id);
CREATE INDEX idx_retailku_sync_field_mapping_local_account
    ON retailku_sync_field_mapping(local_account_id);
CREATE INDEX idx_retailku_sync_field_mapping_secondary_account
    ON retailku_sync_field_mapping(secondary_account_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `key` | TEXT | ya | - | Kunci unik (`UNIQUE`) untuk mapping ini — berdasarkan skema kemungkinan identifier yang dipakai kode sync untuk mencari mapping yang cocok, tapi format/isi pastinya tidak bisa diverifikasi dari skema. |
| `retailku_account_id` | TEXT | ya | - | ID akun di sisi sistem Retailku (eksternal), bukan FK ke tabel lokal manapun. |
| `retailku_account_code` | TEXT | ya | - | Kode akun di sisi Retailku, bebas teks. |
| `retailku_account_name` | TEXT | ya | - | Nama akun di sisi Retailku, bebas teks — kemungkinan untuk tampilan/debugging mapping. |
| `local_account_id` | TEXT | ya | - | FK ke `accounts(id)`. `ON DELETE RESTRICT` — akun lokal tidak bisa dihapus selama masih dipakai sebagai target mapping ini. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `category_id` | TEXT | tidak | NULL | FK ke `categories(id)`. `ON DELETE SET NULL` — kategori dihapus, mapping ini kehilangan kategori tapi tetap ada (tidak ikut terhapus). |
| `description` | TEXT | tidak | NULL | Deskripsi tambahan, bebas teks. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu terakhir baris diubah. **Beda dari kebanyakan tabel lain di skema ini** — kolom ini TIDAK punya trigger auto-update; terisi `datetime('now')` hanya di default saat `INSERT`, dan harus disetel manual oleh kode aplikasi tiap kali `UPDATE` kalau ingin nilainya berubah. |
| `secondary_account_id` | TEXT | tidak | NULL | FK ke `accounts(id)`. `ON DELETE RESTRICT` — akun lokal tidak bisa dihapus selama masih jadi akun sekunder di mapping ini. Ditambahkan di `0023_retailku_sync_field_mapping_secondary_account.sql`; berdasarkan skema kemungkinan dipakai untuk kasus yang perlu dua akun lokal sekaligus (mis. transaksi yang melibatkan dua sisi), tapi skenario pastinya tidak bisa diverifikasi dari skema. |
| `source_kind` | TEXT | ya | `generic` | Jenis sumber mapping ini. Tidak dibatasi `CHECK`, jadi secara skema bebas isi apa saja selain default `generic`. |
| `extra_fields` | TEXT | tidak | NULL | Field tambahan spesifik per `source_kind`, kemungkinan berformat JSON (tipe kolom TEXT, tidak ada validasi format di skema). |

### Catatan

- `key` punya constraint `UNIQUE` sendiri (bukan gabungan kolom) — satu kunci mapping cuma boleh dipakai sekali di seluruh tabel.
- Baik `local_account_id` maupun `secondary_account_id` memakai `ON DELETE RESTRICT` ke `accounts` — beda dari pola `ON DELETE SET NULL`/`CASCADE` yang umum dipakai tabel lain di skema ini (mis. `debts.account_id`, `transactions.account_id`). Konsekuensinya: akun lokal yang sedang dipakai di mapping Retailku manapun tidak bisa dihapus sama sekali sampai mapping-nya dilepas/diubah dulu.
- `source_kind` dan `extra_fields` ditambahkan belakangan (`0024_retailku_sync_field_mapping_extra_fields.sql`) — berdasarkan skema, pola ini dibuat untuk mendukung lebih dari satu jenis sumber selain Retailku di masa depan (nama kolom generik, bukan `retailku_*`), tapi tidak ada sumber lain yang teramati di skema saat ini.
- Lihat [account.md](account.md) dan [category.md](category.md) untuk tabel yang direferensikan.

## Tabel `settings`

Key-value store generik untuk konfigurasi aplikasi desktop. Dibuat di migrasi `0001_initial.sql`.

### SQL final

```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `key` | TEXT | ya | - | Primary key, nama setting. Bebas teks, tidak ada daftar key tetap di skema. |
| `value` | TEXT | tidak | NULL | Nilai setting, disimpan sebagai teks apa pun bentuk aslinya (string, angka, atau JSON yang di-stringify, tergantung kebutuhan tiap key). |

### Catatan

- Struktur sangat sederhana, hanya dua kolom, tidak ada constraint selain primary key `key`.
- Berdasarkan skema, tabel ini kemungkinan menyimpan konfigurasi aplikasi secara umum (mis. preferensi sync, token akses Worker/cloud, dll) — tidak ada key spesifik yang bisa diverifikasi dari skema itu sendiri, jadi daftar isi sebenarnya tidak didokumentasikan di sini.

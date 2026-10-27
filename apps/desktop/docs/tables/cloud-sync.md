
# Tabel `cloud_sync_queue` dan `cloud_sync_rejected_log`

Infrastruktur sinkronisasi dari desktop ke cloud Worker — pola outbox queue. `cloud_sync_queue` dibuat di migrasi `0029_cloud_sync_queue.sql`, lalu diubah beberapa kali seiring tabel baru ditambahkan ke daftar yang bisa disync (`0030_cloud_sync_queue_payload.sql`, `0034_cloud_sync_queue_debts.sql`, `0043_cloud_sync_queue_investment.sql`, `0044_cloud_sync_queue_attachments.sql`, `0046_cloud_sync_queue_labels.sql`, `0055_cloud_sync_queue_third_party_funds.sql`). `cloud_sync_rejected_log` dibuat di migrasi `0054_cloud_sync_rejected_log.sql`.

Berdasarkan skema, pola kerjanya: tiap kali baris di salah satu tabel tersinkron berubah, sebuah entry ditulis ke `cloud_sync_queue`; proses sync (kemungkinan di Worker atau proses background desktop, tidak bisa dipastikan dari skema) membaca antrian ini, mengirim ke cloud, lalu menghapus/menandai entry yang sukses. Entry yang ditolak Worker dicatat ke `cloud_sync_rejected_log` beserta alasannya.

## Tabel `cloud_sync_queue`

### SQL final

```sql
CREATE TABLE cloud_sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL CHECK (
        table_name IN (
            'transactions', 'accounts', 'account_groups', 'categories',
            'contacts', 'debts', 'debt_payments',
            'investment_accounts', 'investment_purchases', 'investment_sales',
            'transaction_attachments',
            'labels', 'transaction_labels', 'category_labels', 'account_labels',
            'third_party_funds'
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
| `id` | INTEGER | ya | autoincrement | Primary key, nomor urut antrian (bukan UUID seperti tabel data lain). |
| `table_name` | TEXT | ya | - | Nama tabel sumber baris yang mau disync. Dibatasi `CHECK` ke daftar tabel yang memang punya jalur sync ke cloud: `transactions`, `accounts`, `account_groups`, `categories`, `contacts`, `debts`, `debt_payments`, `investment_accounts`, `investment_purchases`, `investment_sales`, `transaction_attachments`, `labels`, `transaction_labels`, `category_labels`, `account_labels`, `third_party_funds`. |
| `row_id` | TEXT | ya | - | ID baris di tabel sumber (`table_name`) yang mau disync. |
| `op` | TEXT | ya | - | `upsert` atau `delete` (dibatasi `CHECK`) — operasi apa yang perlu direplikasi ke cloud untuk baris ini. |
| `attempts` | INTEGER | ya | 0 | Hitungan percobaan sync untuk entry ini. Berdasarkan skema kemungkinan dipakai untuk retry counter, tapi kebijakan retry pastinya (batas maksimum, backoff, dll) tidak bisa diverifikasi dari skema. |
| `last_error` | TEXT | tidak | NULL | Pesan error dari percobaan sync terakhir yang gagal, kalau ada. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu entry antrian dibuat. |
| `payload` | TEXT | tidak | NULL | Snapshot data baris sumber yang mau dikirim ke cloud, kemungkinan berformat JSON (tipe kolom TEXT, tidak ada validasi format di skema). Ditambahkan di migrasi `0030_cloud_sync_queue_payload.sql`. |

### Catatan

- `UNIQUE (table_name, row_id)` — satu baris sumber maksimal punya satu entry pending di antrian. Upsert ulang terhadap baris yang sama menggantikan entry lama (lewat `INSERT ... ON CONFLICT` atau sejenisnya), bukan menumpuk entry baru.
- Daftar `table_name` yang diizinkan di `CHECK` bertambah seiring waktu lewat migrasi terpisah tiap kali ada tabel data baru yang perlu disync (lihat daftar migrasi di bagian Deskripsi) — kalau menambah tabel sync baru, `CHECK` ini juga perlu migrasi baru untuk diperluas.
- Tabel ini murni infrastruktur, tidak merujuk konsep bisnis tertentu — relasinya ke tabel data lain cuma lewat `table_name` + `row_id` sebagai referensi longgar (tidak ada FK sungguhan, karena `table_name` dinamis).

## Tabel `cloud_sync_rejected_log`

### SQL final

```sql
CREATE TABLE cloud_sync_rejected_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    rejected_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (table_name, row_id)
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | INTEGER | ya | autoincrement | Primary key, nomor urut log. |
| `table_name` | TEXT | ya | - | Nama tabel sumber baris yang ditolak. Tidak ada `CHECK` di sini (beda dari `cloud_sync_queue.table_name`), jadi secara skema bebas isi apa saja. |
| `row_id` | TEXT | ya | - | ID baris di tabel sumber yang ditolak. |
| `reason` | TEXT | ya | - | Alasan penolakan dari Worker. Isi bebas teks, tidak ada enum/format tetap di skema. |
| `rejected_at` | TEXT | ya | `datetime('now')` | Waktu penolakan dicatat. |

### Catatan

- `UNIQUE (table_name, row_id)` — satu baris sumber maksimal punya satu entry log penolakan; penolakan berikutnya untuk baris yang sama kemungkinan menimpa entry lama (lewat upsert), bukan menumpuk riwayat.
- Tidak ada FK balik ke `cloud_sync_queue` — log ini berdiri sendiri, cuma tahu tabel+row asal via `table_name`/`row_id` seperti pada `cloud_sync_queue`.
- Tidak ada kolom status "sudah ditinjau"/retry dari log ini — begitu baris ditolak dan tercatat di sini, skema tidak menunjukkan mekanisme otomatis untuk mencoba ulang baris tersebut.

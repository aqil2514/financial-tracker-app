
# Tabel investasi (`investment_accounts`, `investment_purchases`, `investment_sales`)

Tiga tabel ini satu domain erat — tipe akun **Investasi** (`accounts.account_type = 'investment'`) — jadi digabung satu file. Lihat [konsep-investasi.md](../../../../docs/concept/konsep-investasi.md) untuk model bisnis lengkapnya; dokumen ini murni referensi skema. Dibuat di migrasi `0036_investment_accounts_and_purchases.ts`, lalu dievolusi lewat `0037_investment_accounts_market_value.ts`, `0038_investment_purchases_nullable_unit_price.ts`, `0039_investment_sales.ts`, `0040_investment_sales_adjustment_transaction.ts`, `0041_investment_sales_nullable_realized_pl.ts`, dan kolom sync di `0042_investment_cloud_sync_columns.ts`/`0043_cloud_sync_queue_investment.ts`.

Konsep inti: satu akun investasi = satu instrumen tunggal (bukan portofolio gabungan). Modal (cost basis) TIDAK disimpan di sini — tetap `accounts.balance`, dihitung dari transaksi seperti tipe akun lain (lihat [account.md](account.md)). Ketiga tabel ini murni riwayat/detail tambahan di atas mekanisme transaksi itu.

## `investment_accounts`

Tabel ekstensi 1:1 untuk `accounts` bertipe `investment` — pola sama seperti rencana `credit_accounts`/`debt_accounts`. Menyimpan dua hal yang murni kosmetik/manual di level akun, bukan hasil hitung.

### SQL final

```sql
CREATE TABLE investment_accounts (
    account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    unit_label TEXT NOT NULL,
    current_market_value REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `account_id` | TEXT | ya | - | Primary key SEKALIGUS foreign key ke `accounts(id)`, `ON DELETE CASCADE` — akun induk dihapus, baris detail ini ikut terhapus. Bukan PK independen karena relasinya memang 1:1, satu akun investasi hanya punya satu baris detail. |
| `unit_label` | TEXT | ya | - | Satuan tampilan unit instrumen ini (mis. "lembar", "unit", "gram") — bebas teks, murni kosmetik untuk UI, tidak dipakai logic apa pun. |
| `current_market_value` | REAL | ya | 0 | Nilai pasar TOTAL instrumen ini saat ini — **diupdate manual oleh user kapan saja**, BUKAN ditarik otomatis dari API harga pasar real-time, dan BUKAN dihitung dari unit × harga. Satu-satunya angka yang perlu diupdate manual berkala di level akun. Update kolom ini TIDAK membuat transaksi apa pun dan TIDAK mengubah `accounts.balance` sama sekali. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu terakhir baris ini berubah. Dipakai GANDA: sebagai indikator staleness nilai pasar (fitur bisnis, "terakhir diupdate X waktu lalu") DAN kebetulan juga cocok dipakai sebagai timestamp LWW untuk sync — diisi manual tiap `unit_label`/`current_market_value` berubah. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sinkronisasi cloud. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — asal baris ini untuk mekanisme sync dua-arah ke Cloudflare D1. |

## `investment_purchases`

Riwayat pembelian per lot. Lahir **otomatis** dari transaksi transfer kas → akun investment (pola sama `debts` yang lahir dari transfer kas↔debt, lihat `applyDebtTransaction`) — field `unit` dan `price_per_unit` diisi manual di form transaksi saat itu, independen dari nominal transfer (boleh berbeda, tidak divalidasi). Total unit yang dipegang akun TIDAK disimpan sebagai kolom di `investment_accounts` — selalu `SUM(unit)` dari tabel ini.

### SQL final

```sql
CREATE TABLE investment_purchases (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL,
    price_per_unit REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_investment_purchases_account ON investment_purchases(account_id);
CREATE INDEX idx_investment_purchases_transaction ON investment_purchases(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE` — akun dihapus, riwayat pembelian ikut terhapus. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi transfer yang melahirkan baris ini. NULL untuk baris hasil `record_mode: 'direct'` yang bukan dari transfer kas (lihat Catatan), atau kalau transaksi asalnya dihapus. Detail tabel `transactions` di [transaction.md](transaction.md). |
| `unit` | REAL | tidak | NULL | Jumlah unit/lot yang dibeli. Nullable karena order beli yang masih diproses (`status = 'pending'`) belum tentu tahu persis unitnya — NAB/harga final baru pasti setelah settlement (T+1/T+2), diisi belakangan lewat edit baris. |
| `price_per_unit` | REAL | tidak | NULL | Harga beli per unit saat itu, snapshot historis. Nullable dengan alasan sama seperti `unit` — estimasi dulu, dipastikan saat settle. |
| `date` | TEXT | ya | - | Tanggal pembelian. |
| `status` | TEXT | ya | `pending` | `pending` atau `settled`, dibatasi `CHECK`. Lihat Catatan — ini bukan kolom status biasa, ada aturan bisnis penting yang menyertainya. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah (mis. saat settlement dikonfirmasi dan `unit`/`price_per_unit`/`status` diedit). Backfill awal = `created_at`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sinkronisasi cloud. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — asal baris ini untuk mekanisme sync. |

## `investment_sales`

Riwayat penjualan/penarikan sebagian per lot — kebalikan arah dari `investment_purchases`. Beda penting dari pembelian: `unit` dan `price_per_unit` di sini **wajib diisi** (tidak nullable), karena input jual memang selalu butuh kedua angka itu sejak awal (simetris dengan form beli, tapi tanpa skenario "order diproses belum tahu unitnya" yang berlaku di pembelian).

### SQL final

```sql
CREATE TABLE investment_sales (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    adjustment_transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
    unit REAL NOT NULL,
    price_per_unit REAL NOT NULL,
    average_cost_per_unit REAL,
    realized_pl REAL,
    date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT,
    deleted_at TEXT,
    sync_source TEXT NOT NULL DEFAULT 'pc' CHECK (sync_source IN ('pc', 'mcp'))
);

CREATE INDEX idx_investment_sales_account ON investment_sales(account_id);
CREATE INDEX idx_investment_sales_adjustment_transaction ON investment_sales(adjustment_transaction_id);
CREATE INDEX idx_investment_sales_transaction ON investment_sales(transaction_id);
```

### Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, `ON DELETE CASCADE`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL` — transaksi transfer utama (leg kas yang menerima sebesar `average_cost_per_unit × unit`, BUKAN nominal jual penuh). NULL selama `status = 'pending'` karena belum ada transaksi apa pun dibuat (lihat Catatan), atau untuk baris write-off (unit hilang tanpa kas, `price_per_unit = 0`) yang transaksinya `expense` langsung di akun investment itu sendiri. Detail di [transaction.md](transaction.md). |
| `adjustment_transaction_id` | TEXT | tidak | NULL | FK **terpisah** ke `transactions(id)`, `ON DELETE SET NULL` — transaksi `income`/`expense` KEDUA di akun kas untuk selisih Realized P/L (karena satu baris transfer cuma punya satu kolom `amount`, leg utama dan selisih P/L tidak bisa digabung satu transaksi). NULL kalau `realized_pl` == 0 (tidak ada selisih) atau kalau baris write-off (tidak ada leg kas sama sekali). Lihat [transaction.md](transaction.md). |
| `unit` | REAL | ya | - | Jumlah unit yang dijual/dilepas. Tidak nullable, beda dari `investment_purchases.unit`. |
| `price_per_unit` | REAL | ya | - | Harga jual per unit saat itu. Tidak nullable. `0` khusus menandai baris write-off (unit hilang tanpa kas masuk, mis. hibah keluar/delisting). |
| `average_cost_per_unit` | REAL | tidak | NULL | Average cost per unit SAAT penjualan ini di-settle — snapshot, bukan dihitung ulang nanti. **NULL selama `status = 'pending'`**, baru dihitung & disimpan permanen begitu `status` jadi `'settled'`. Alasan: average cost masih bisa bergeser kalau ada pembelian baru di antara create dan settle, jadi tidak ditulis seolah final sebelum benar-benar settled. |
| `realized_pl` | REAL | tidak | NULL | Laba/rugi terealisasi = `(price_per_unit − average_cost_per_unit) × unit`, dihitung SAAT settle. Sama seperti `average_cost_per_unit`, **NULL selama `status = 'pending'`** — baru final dan ditulis permanen setelah settled. Untuk baris write-off, selalu negatif penuh (`= -average_cost_per_unit × unit`). |
| `date` | TEXT | ya | - | Tanggal penjualan. |
| `status` | TEXT | ya | `pending` | `pending` atau `settled`, dibatasi `CHECK`. Lihat Catatan — aturan bisnis krusial menyertai kolom ini. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah. Backfill awal = `created_at`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete untuk sinkronisasi cloud. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp` — asal baris ini untuk mekanisme sync. |

## Catatan

- **Status `pending` TIDAK BOLEH insert transaksi sampai `settled` — ini aturan bisnis krusial, bukan sekadar kolom status biasa.** Untuk `investment_purchases`, transaksi transfer kas→investment tetap SATU kali dibuat di awal (modal sudah keluar dari kas duluan, unit-nya saja yang belum pasti). Untuk `investment_sales`, ARAHNYA DIBALIK: saat baris dibuat dengan `status = 'pending'`, **tidak ada baris `transactions` apa pun yang dibuat** — kas belum tersentuh sama sekali, meski unit sudah dikurangi optimis dari holding. Transaksi transfer (`transaction_id`) dan transaksi penyesuaian (`adjustment_transaction_id`) baru dibuat di titik baris itu disettle lewat aksi "Settle" terpisah (yang meminta user memilih akun kas tujuan saat itu, karena belum ada akun kas yang terlibat selama masih pending).
- **Average cost, bukan FIFO.** `average_cost_per_unit` dihitung dari `SUM(unit × price_per_unit) / SUM(unit)` atas seluruh baris `investment_purchases` berstatus `settled` milik akun yang sama — satu angka rata-rata dipakai untuk semua unit yang dijual, konsisten dengan cara broker/platform investasi nyata (reksadana, saham, emas, kripto) melacak cost basis.
- **"Total unit yang bisa dijual" punya rumus khusus**, beda dari total unit untuk Unrealized P/L (yang mengikutkan pending+settled pembelian): `SUM(unit, investment_purchases WHERE status='settled') − SUM(unit, investment_sales WHERE status IN ('pending','settled'))`. Pembelian yang masih pending tidak ikut dihitung sebagai unit yang bisa dijual — ini basis validasi cegah oversell (ditolak di titik input, beda dari filosofi "tidak menghakimi" yang berlaku untuk unit/harga saat beli).
- `investment_purchases.unit`/`price_per_unit` NULLABLE karena order beli yang masih `pending` (settlement T+1/T+2) belum tentu tahu unit/harga final — diisi manual lewat edit baris setelah settlement dikonfirmasi. `investment_sales.unit`/`price_per_unit` sebaliknya NOT NULL karena form jual selalu mewajibkan user mengisi keduanya sejak awal input, tidak ada skenario "belum tahu" yang sama seperti beli.
- Baris `investment_purchases` dengan `transaction_id` berasal dari transaksi `type = 'income'` (bukan `'transfer'`) adalah hasil `record_mode: 'direct'` — unit masuk tanpa transfer kas (hibah, bonus saham, right issue, atau pencatatan saldo awal sebelum pakai app). Tidak ada kolom `source` terpisah; pembeda ini di-derive lewat JOIN ke `transactions.type`.
- Baris `investment_sales` dengan `price_per_unit = 0` dan `adjustment_transaction_id IS NULL` adalah hasil write-off (unit hilang/dilepas tanpa kas masuk sama sekali, mis. hibah keluar atau delisting) — transaksinya `expense` langsung di akun investment itu sendiri, `status` selalu `'settled'` (tidak ada konsep pending untuk write-off).
- Kolom `updated_at`/`deleted_at`/`sync_source` di ketiga tabel ini untuk soft-delete dan sinkronisasi dua-arah ke Cloudflare D1 — pola sama seperti tabel lain di app ini. Trigger `trg_investment_accounts_updated_at`, `trg_investment_purchases_updated_at`, dan `trg_investment_sales_updated_at` masing-masing otomatis menimpa `updated_at` dengan `datetime('now')` tiap `UPDATE` yang tidak menyetel kolom itu sendiri.
- Laporan/agregat total kekayaan (dashboard, laporan per tipe akun) tetap menjumlah `accounts.balance`, BUKAN `current_market_value` — nilai pasar dan Unrealized/Realized P/L murni informasi tambahan, tidak ikut masuk angka SUM total.
- Lihat [account.md](account.md) untuk detail tabel `accounts` (termasuk cara saldo/modal dihitung) dan [transaction.md](transaction.md) untuk detail tabel `transactions`.

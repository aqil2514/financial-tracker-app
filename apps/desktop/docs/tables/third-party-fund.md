# Tabel `third_party_funds`

Riwayat titip/ambil/pindah dana pihak ketiga — baris detail per peristiwa pada akun bertipe `third_party` (satu akun virtual per TEMPAT fisik, mis. "Kas Orang Lain [Tunai]"), dibedakan per penitip lewat `contact_id` (reuse pola `debts.contact_id`, bukan satu akun per kontak). Lihat [konsep-dana-pihak-ketiga.md](../../../../docs/concept/konsep-dana-pihak-ketiga.md) untuk model lengkapnya.

Dibuat di migrasi `0049_account_type_third_party.sql`. `cloud_sync_queue.table_name` ikut ditambah `'third_party_funds'` di migrasi `0055_cloud_sync_queue_third_party_funds.sql` (perbaikan CHECK constraint yang terlupa saat tabel ini masuk antrean sync).

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
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
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
| `contact_id` | TEXT | ya | - | FK ke `contacts(id)`, pihak yang nitip/mengambil. NOT NULL dengan `ON DELETE RESTRICT` — beda dari `debts.contact_id` yang nullable/`ON DELETE SET NULL`. Konsep mewajibkan kontak selalu terisi untuk titip/ambil (mirror pola `cash → debt`), jadi kontak tidak boleh dihapus selama masih punya riwayat dana pihak ketiga — RESTRICT mencegah baris ini jadi "milik siapa saja" (beda dari `debts` yang memang boleh kontaknya hilang/`SET NULL`). |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`. `ON DELETE SET NULL` — transaksi sumber dihapus, baris riwayat ini tetap ada tapi kehilangan tautannya. |
| `direction` | TEXT | ya | - | `in` (dana masuk/titip) atau `out` (dana keluar/ambil), dibatasi `CHECK`. Disimpan sebagai kolom sendiri (bukan sekadar baca `transactions.type`) karena transfer `third_party → third_party` (pindah tempat dan/atau pindah kepemilikan) menghasilkan DUA baris per satu transaksi — satu `out` di kontak+akun asal, satu `in` di kontak+akun tujuan — satu `transactions.type = 'transfer'` saja tidak cukup merepresentasikan dua kontak independen itu. Tidak ada kolom `type` seperti `debts.type` (`receivable`/`payable`) karena arah sudah terwakili `direction` ini. |
| `amount` | REAL | ya | - | Nominal dana yang titip/ambil/pindah pada baris ini. |
| `date` | TEXT | ya | - | Tanggal peristiwa. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | ya | `datetime('now')` | Waktu baris terakhir diubah, auto-terupdate lewat trigger `trg_third_party_funds_updated_at`. |
| `deleted_at` | TEXT | tidak | NULL | Soft-delete. NULL berarti masih aktif. |
| `sync_source` | TEXT | ya | `pc` | `pc` atau `mcp`, dibatasi `CHECK` — asal baris ini dibuat/diubah (desktop atau lewat MCP server), bagian dari mekanisme sinkronisasi cloud. |

## Catatan

- **Tidak ada kolom status "lunas"/"berjalan"** seperti `debts.status`. Sisa titipan dihitung ulang: `SUM(amount WHERE direction='in') - SUM(amount WHERE direction='out')` per `(account_id, contact_id)` — konsisten dengan sifat "rekening berjalan" tanpa titik "selesai" alami, beda dari utang/piutang yang punya status lunas.
- **Validasi "ambil melebihi titipan"** dilakukan di level aplikasi (`applyThirdPartyTransaction`), bukan `CHECK` di skema: sebelum insert baris `direction='out'`, sisa titipan dihitung via query SUM di atas, ditolak kalau nominal yang diambil melebihi sisa — pola serupa validasi unit investasi, bukan reuse langsung.
- **Titip masuk/ambil keluar TIDAK PERNAH berupa `transfer` dengan akun `cash`** — walau terlihat seperti uang berpindah dari/ke kas, dicatat sebagai `income`/`expense` satu sisi pada akun `third_party` itu sendiri, karena uang itu tidak pernah benar-benar milik akun kas Aqil yang terlibat. `transfer` hanya valid untuk kombinasi `third_party → third_party` (pindah tempat dan/atau pindah kepemilikan, kontak sisi keluar dan masuk independen, boleh sama boleh beda).
- **Dikecualikan dari laporan cashflow** (`WHERE account.account_type != 'third_party'`) karena titip/ambil tidak pernah mengubah kekayaan bersih Aqil (uang masuk menciptakan kewajiban setara untuk dikembalikan) — tapi saldo akun `third_party` itu sendiri (via `accounts`) tetap dihitung apa adanya, tidak disembunyikan.
- Perbedaan `contact_id` NOT NULL/`RESTRICT` di tabel ini vs nullable/`SET NULL` di `debts` BUKAN kebetulan penamaan — ini keputusan desain eksplisit dari dokumen konsep, bukan variasi tak sengaja antar tabel serupa.
- Tidak ditemukan aturan "pending tidak boleh insert transaksi sampai settled" (seperti pada investasi) untuk dana pihak ketiga di dokumen konsep — tabel ini tidak punya kolom `status` sama sekali, jadi tidak ada state "pending" yang perlu ditunggu settle.
- Lihat juga [account.md](account.md) (tipe akun `third_party`) dan [debt.md](debt.md) (pembanding pola `contact_id` di konsep utang/piutang).

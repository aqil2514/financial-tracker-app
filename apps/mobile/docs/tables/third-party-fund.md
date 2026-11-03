
# Tabel `third_party_funds`

Riwayat titip/ambil/pindah dana pihak ketiga — baris detail per peristiwa pada akun bertipe `third_party` di [account.md](account.md). Satu akun `third_party` mewakili satu TEMPAT fisik (mis. "Kas Orang Lain [Tunai]"), dan penitip dibedakan per baris lewat `contact_id` ke [contact.md](contact.md), bukan satu akun per penitip. Lihat [konsep-dana-pihak-ketiga.md](../../../../docs/concept/konsep-dana-pihak-ketiga.md) untuk aturan bisnisnya dan [porting-account-third-party.md](../todos/done/porting-account-third-party.md) untuk riset porting dari desktop.

Dibuat di migrasi `0010_third_party_funds.ts`. Skema mengacu ke desktop (`apps/desktop/docs/tables/third-party-fund.md`) tanpa `deleted_at` dan `sync_source`; `updated_at` ditambahkan di `0011`.

## SQL final

```sql
CREATE TABLE third_party_funds (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX idx_third_party_funds_account ON third_party_funds(account_id);
CREATE INDEX idx_third_party_funds_contact ON third_party_funds(contact_id);
CREATE INDEX idx_third_party_funds_transaction ON third_party_funds(transaction_id);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `account_id` | TEXT | ya | - | FK ke `accounts(id)`, akun bertipe `third_party` (tempat fisik titipan disimpan). `ON DELETE CASCADE` — akun dihapus, seluruh riwayat di akun itu ikut terhapus, jadi UI wajib menolak hapus akun yang masih punya riwayat. |
| `contact_id` | TEXT | ya | - | FK ke `contacts(id)`, pihak yang menitip/mengambil. NOT NULL dengan `ON DELETE RESTRICT`: kontak tidak bisa dihapus selama masih punya riwayat dana pihak ketiga. Beda dari `debts.contact_id` yang nullable/`SET NULL`. |
| `transaction_id` | TEXT | tidak | NULL | FK ke `transactions(id)`, `ON DELETE SET NULL`. Titip/ambil menghasilkan satu baris per transaksi, transfer `third_party → third_party` menghasilkan dua baris dengan `transaction_id` yang sama. Baris yatim (transaksi sudah hilang) tidak boleh ada: hapus transaksi wajib menghapus barisnya lebih dulu. |
| `direction` | TEXT | ya | - | `in` (dana masuk/titip) atau `out` (dana keluar/ambil), dibatasi `CHECK`. Disimpan sendiri karena transfer menghasilkan dua baris dengan arah berlawanan dan kontak yang bisa berbeda. |
| `amount` | REAL | ya | - | Nominal pada baris ini, selalu positif; arah ditentukan `direction`. |
| `date` | TEXT | ya | - | Tanggal peristiwa. |
| `note` | TEXT | tidak | NULL | Catatan bebas. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |
| `updated_at` | TEXT | tidak | NULL | Waktu terakhir baris berubah (UTC, `YYYY-MM-DD HH:mm:ss`), dasar pembanding last-write-wins untuk sync. Ditambahkan di `0011`, di-backfill dari `created_at`. Diisi otomatis trigger (INSERT tanpa nilai, UPDATE yang tidak menyentuhnya); hasil pull menulisnya eksplisit. Lihat [cloud-sync.md](cloud-sync.md). |

## Catatan

- **Tidak ada kolom status.** Sisa titipan dihitung ulang: `SUM(CASE WHEN direction = 'in' THEN amount ELSE -amount END)` per `(account_id, contact_id)`.
- **Validasi ambil melebihi titipan** dilakukan di level aplikasi sebelum menulis baris `out`, bukan `CHECK` di skema.
- **Hard delete.** Mobile menghapus baris sungguhan, sedangkan desktop/D1 memakai soft delete (`deleted_at`). Perbedaan ini sengaja: penghapusan dikirim ke cloud lewat antrean `delete`, lihat [cloud-sync.md](cloud-sync.md).
- **Titip/ambil tidak pernah transfer dengan kas.** Dicatat sebagai `income`/`expense` satu sisi pada akun `third_party`; transfer hanya valid untuk `third_party → third_party`.
- **Dikecualikan dari cashflow**: transaksi pada akun `third_party` tidak ikut agregat Pendapatan/Pengeluaran lintas akun, tapi saldo akun itu sendiri tetap dihitung apa adanya.
- Lihat juga [account.md](account.md), [contact.md](contact.md), dan [transaction.md](transaction.md).

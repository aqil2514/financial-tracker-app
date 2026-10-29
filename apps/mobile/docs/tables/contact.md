
# Tabel `contacts`

Daftar nama pihak (orang/badan) yang terlibat dalam piutang/utang — siapa yang berutang ke kita atau kita berutang padanya. Entitas independen (bukan bagian dari siklus hidup `debts`), tapi saat ini satu-satunya pemakainya adalah fitur utang-piutang — lihat [debt.md](debt.md).

Dibuat di migrasi `0008_debts.ts`.

## SQL final

```sql
CREATE TABLE contacts (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_contacts_name ON contacts(name);
```

## Kolom

| Kolom | Tipe | Wajib | Default | Keterangan |
|---|---|---|---|---|
| `id` | TEXT | ya | - | Primary key, UUID. |
| `name` | TEXT | ya | - | Nama kontak, bebas (mis. "Budi", "Toko Jaya"). Diindeks (`idx_contacts_name`) untuk pencarian/combobox. |
| `note` | TEXT | tidak | NULL | Catatan tambahan, plain text biasa — **beda dari desktop** yang menyimpan ini sebagai rich text TipTap (`JSON.stringify` JSONContent); mobile belum punya editor rich text di tempat lain manapun, jadi sengaja disederhanakan jadi `TEXT` biasa. |
| `created_at` | TEXT | ya | `datetime('now')` | Waktu baris dibuat. |

## Catatan

- Sengaja **tanpa** `deleted_at`/`sync_source` dibanding skema desktop, sama seperti [account.md](account.md)/[account-group.md](account-group.md) — ditunda sampai semua porting lokal tipe akun selesai.
- **Delete selalu hard delete**, tidak dicegah walau kontak masih punya `debts`/`debt_payments` yang merujuknya — aman karena FK `debts.contact_id` adalah `ON DELETE SET NULL` (riwayat piutang/utang tetap ada, cuma kehilangan tautan nama kontaknya). UI wajib menampilkan peringatan ini saat konfirmasi delete.
- Create-inline dari form transaksi memakai pola get-or-create by nama (bukan dialog form penuh terpisah) — lihat [debt.md](debt.md) bagian UI Form Transaksi.
- Lihat juga [debt.md](debt.md) untuk tabel yang berelasi langsung ke tabel ini.

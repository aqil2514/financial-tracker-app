# Debt tetap "Dihapuskan" walau remaining > 0 setelah transaksi penutup write-off dihapus

## Bagaimana ketahuan

Dogfooding di mobile, fitur Utang Piutang (halaman list + ringkasan kontak). Alur:

1. Sebuah piutang ditandai "Dihapuskan" (write-off) — status `written_off`, remaining jadi Rp0.
2. Transaksi penutup write-off (transaksi `expense`/`income` yang dibuat otomatis oleh `writeOffDebt`) dihapus lewat halaman edit transaksi.
3. Expected: debt kembali ke status `ongoing` karena remaining sudah bukan Rp0 lagi.
4. Actual: debt tetap berstatus `written_off` (badge "Dihapuskan"), tapi `remaining` sudah naik lagi (mis. Rp1.000) — kombinasi status "selesai" dengan sisa > 0 yang seharusnya tidak mungkin terjadi.

Screenshot menunjukkan badge kuning "Dihapuskan" berdampingan dengan nominal Rp1.000, bukan Rp0.

## Root cause

Logic downgrade status debt saat sebuah `debt_payments` dihapus (dipicu oleh penghapusan transaksi terkait) di mobile hanya mengecek:

```sql
UPDATE debts SET status = 'ongoing'
WHERE id = ? AND status = 'paid' AND amount > COALESCE(...)
```

Kondisi `status = 'paid'` tidak mencakup `status = 'written_off'`. Payment penutup dari `writeOffDebt` tersimpan sebagai baris `debt_payments` biasa (sengaja, supaya saldo akun debt ikut ke nol lewat jalur `transactions` yang sah — lihat komentar di `write-off-debt.ts`). Begitu transaksi penutup itu dihapus, `debt_payments` ikut terhapus dan `remaining` naik lagi, tapi klausa `WHERE status = 'paid'` tidak pernah match untuk debt yang statusnya `written_off`, jadi downgrade-nya tidak pernah jalan.

Bug ini ada di 3 tempat yang sama-sama meniru pola ini:
- `shared/debts/detach-debt-for-deleted-transaction.ts` (delete transaksi)
- `shared/debts/apply-debt-transaction-edit.ts` (edit transaksi Jalur 1 — transfer)
- `shared/debts/apply-direct-debt-transaction-edit.ts` (edit transaksi Jalur 2 — income/expense langsung)

**Bug yang sama persis juga ada di desktop** (`apps/desktop/src/shared/debts/apply-debt-transaction/edit.ts` dan `delete.ts`, kondisi `WHERE status = 'paid'` yang identik) — bukan sesuatu yang lahir dari porting ke mobile, tapi bug pre-existing yang baru ketahuan lewat dogfooding mobile. **Belum diperbaiki di desktop** (di luar scope sesi ini).

## Perbaikan

Kondisi diperluas jadi `status IN ('paid', 'written_off')` di ketiga file mobile di atas — debt yang tadinya `written_off` ikut diturunkan ke `ongoing` kalau payment penutupnya dihapus dan remaining jadi > 0 lagi, sama perlakuannya dengan debt yang tadinya `paid`.

## Yang TIDAK diubah

- Desktop (`apps/desktop/src/shared/debts/apply-debt-transaction/edit.ts`, `delete.ts`) — bug yang sama masih ada di sana, belum disentuh.
- Mekanisme `writeOffDebt` itu sendiri tidak diubah — payment penutup tetap baris `debt_payments` biasa yang menunjuk transaksi riil, sesuai desain.

## Verifikasi

- 2 unit test baru: `detach-debt-for-deleted-transaction.test.ts` (kasus delete transaksi penutup write-off) dan `apply-debt-transaction-edit.test.ts` (kasus edit transaksi role `payment` dengan debt induk `written_off`).
- Diverifikasi manual di Expo: expand row debt yang written_off, hapus transaksi penutupnya, kembali ke halaman Utang Piutang — status kembali ke "Berjalan" dengan remaining yang benar.

## Pelajaran

Status "selesai" pada sebuah entity (di sini: `debts.status`) yang punya lebih dari satu jalur mencapai "selesai" (`paid` lewat pelunasan normal, `written_off` lewat penghapusan) butuh logic *reversal* yang mencakup SEMUA jalur itu, bukan cuma jalur yang paling umum dipikirkan saat menulis guard pertama kali. Kalau fitur "membatalkan status selesai" ditambahkan belakangan (di sini: downgrade saat payment dihapus) tapi fitur "status selesai jalur kedua" (write-off) ditambahkan lebih belakangan lagi, mudah sekali guard lama lupa di-retrofit untuk mencakup jalur baru — cek ulang setiap `WHERE status = 'X'` setiap kali menambah nilai enum status baru ke kolom yang sama.

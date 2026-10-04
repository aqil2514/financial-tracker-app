# Laporan Saldo Tidak Memfilter Akun Nonaktif

## Status & TODO saat ini (ringkas)

- [ ] Audit semua query agregasi saldo (`use-account-balances.ts`
      dikonfirmasi, lainnya BELUM) — tambahkan filter `is_active = 1`
      atau putuskan desain alternatif (lihat "Pertanyaan yang belum
      dijawab" di bawah).

## Latar belakang

Ditemukan 2026-10-04 saat investigasi gap tidak terkait
(`debt-receivable-tracking.md`, "Temuan BARU: data lama `debt_payments`
dengan `transaction_id NULL`") — user menonaktifkan (`is_active = 0`,
BUKAN dihapus) beberapa akun lama bertipe `debt` di production ("Keluarga",
"Bisnis", "Orang Lain") setelah "mulai dengan yang bersih" pakai akun
"Piutang" tunggal. Saat mengecek apakah akun nonaktif ini masih
mempengaruhi saldo yang ditampilkan ke user, ditemukan:

`useAccountBalances` (`apps/desktop/src/features/reports/use-account-balances.ts`)
menghitung saldo SEMUA baris `accounts` lewat subquery agregat dari
`transactions` — **TIDAK ADA klausa `WHERE is_active = 1`** sama sekali.
Akun yang sudah dinonaktifkan user tetap ikut muncul/terhitung di
laporan "Saldo per Akun".

`use-accounts.ts` (`apps/desktop/src/hooks/resources/use-accounts.ts`,
dipakai mayoritas UI form/combobox akun) SAMA — query
`SELECT_ACCOUNTS_WITH_BALANCE` juga tidak filter `is_active`, tapi untuk
hook ini mungkin MEMANG disengaja (UI lain yang consume hook ini
mungkin filter `is_active` sendiri di level komponen, mis. dropdown
pilih akun) — BELUM diverifikasi caller-caller-nya satu per satu.

## Kenapa ini scope TERPISAH dari fitur utang-piutang

Gap ini AWALNYA ditemukan dalam konteks akun bertipe `debt` yang
nonaktif, tapi akar masalahnya GENERIK — berlaku untuk akun TIPE APA
PUN yang dinonaktifkan user tapi masih punya riwayat transaksi (cash,
debt, atau tipe lain yang akan menyusul). Bukan bagian dari logic
`debts`/`debt_payments`, murni soal bagaimana laporan saldo
mengagregasi tabel `accounts`. Lihat
`docs/todos/done/debt-receivable-tracking.md` untuk konteks penemuan
awal gap ini.

## Pertanyaan yang belum dijawab

- Filter `is_active = 1` di level SQL (paling sederhana), atau
  pendekatan lain (mis. tampilkan tapi beri label "Nonaktif", opsional
  toggle "tampilkan akun nonaktif" di UI laporan)?
- Apakah SEMUA agregasi saldo harus filter `is_active` secara seragam,
  atau ada kasus yang sengaja butuh menyertakan akun nonaktif (mis.
  laporan histori/audit yang justru ingin tahu kontribusi akun yang
  sudah ditinggalkan)?
- Scope audit: query mana saja selain `use-account-balances.ts` dan
  `use-accounts.ts` yang perlu dicek — belum ditelusuri ke
  `use-account-group-balances.ts`, dashboard summary, dan lainnya.

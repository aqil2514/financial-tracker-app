# Edit transfer yang ganti pasangan akun dari cash↔investment ke cash↔debt (atau sebaliknya) menyisakan baris investment_purchases yatim

Ditemukan saat menguji coba dialog Edit (BaseForm) yang baru dibuat (lihat
`base-form-migration/README.md`) — transaksi transfer diedit dua kali
berturut-turut: pertama cash → akun investment (dicek benar, baris
`investment_purchases` lahir dengan `status: settled`), lalu diedit LAGI
jadi cash → akun debt (ganti akun tujuan transfer sepenuhnya, bukan cuma
nominal/tanggal). Belum pernah dicoba sebelumnya di sesi manapun — pola uji
coba sebelumnya selalu mengedit field dalam SATU pasangan akun yang sama,
tidak pernah mengganti pasangan akunnya sendiri lintas domain
investment↔debt.

**Bukan regresi BaseForm.** Dibuktikan lewat `diff` langsung: logika
`transfer/index.ts` dan `transfer/debt.ts` di
`base-form-migration/hooks/update-transaction/` dan di
`hooks/use-update-transaction/update-transaction/` (versi lama, sumber
duplikasi sesi 2026-10-14 sesi 2) identik — satu-satunya beda cuma
kedalaman path import relatif. Bug ini sudah ada di form aktif yang dipakai
sehari-hari, cuma baru ketahuan sekarang.

## Bagaimana ketahuan

1. Transaksi `01a13998-72a2-75c4-91ed-eeebb380de4e` (awalnya expense biasa)
   diedit lewat dialog Edit (BaseForm) jadi transfer cash → akun investment.
   Dicek lewat SQL: baris `investment_purchases` id `01a139b5-...` lahir
   dengan benar (`status: settled`, `unit: 1.0`, `price_per_unit: 10000.0`),
   `cloud_sync_queue` dapat entry `upsert` benar untuk baris itu.
2. Transaksi YANG SAMA diedit lagi, kali ini akun tujuan transfer diganti
   ke akun debt ("Piutang"). Dicek lewat SQL: baris `debts` baru lahir
   dengan benar (`receivable`, `status: ongoing`, ter-link ke transaksi).
3. **Baris `investment_purchases` id `01a139b5-...` dari langkah 1 masih
   ada, tidak terhapus** — `transaction_id`-nya tetap menunjuk ke transaksi
   yang sekarang sebenarnya debt, bukan investment lagi. Baris yatim
   (orphan) permanen.

## Root cause

`updateTransferTransaction` (`transfer/index.ts`) mengklasifikasi pasangan
akun BARU lewat `classifyAccountPair(sourceType, destinationType)`, lalu
memilih SATU cabang berdasarkan hasil itu:

```ts
switch (pairKind) {
  case "cash-debt":
  case "debt-cash":
  case "debt-debt":
    return updateDebtTransfer({ ... });
  case "cash-investment":
  case "investment-cash":
    return updateInvestmentTransfer({ ... });
  case "cash-cash":
  default:
    return updateCashToCashTransfer({ ... });
}
```

`updateDebtTransfer` memanggil `applyDebtTransactionEdit` — tidak pernah
menyentuh `investment_purchases` sama sekali. Sebaliknya `updateInvestmentTransfer`
memanggil `applyInvestmentTransactionEdit` — tidak pernah menyentuh `debts`.
Begitu pairKind BARU beda domain dari pairKind LAMA, cabang yang mengurus
domain LAMA tidak pernah terpanggil, jadi baris lamanya tidak pernah
dibersihkan.

Ini kelas bug yang mirip (tapi beda arah) dari yang sudah diantisipasi di
komentar `apply-investment-transaction.ts` (revisi 2026-10-08, "bug
ditemukan lewat dogfooding") — fix saat itu menangani kasus baris
`investment_purchases` lama yang harus di-UPDATE in-place saat `type`
berubah dari transfer ke non-transfer (direct). Kasus ini beda: pairKind
tetap sama-sama "transfer", tapi DOMAIN tujuannya berpindah silang
(investment → debt), jadi tidak tertangkap percabangan `type !== 'transfer'`
yang sudah ada.

## Dampak

- Baris `investment_purchases` yatim ikut tersinkron ke cloud
  (`cloud_sync_queue` sudah dapat entry `upsert` SEBELUM pasangan akun
  diganti) — berarti baris yatim ini juga nyangkut di D1, bukan cuma lokal.
- `investment_purchases.account_id` yatim ini masih menunjuk akun investasi
  lama — kalau akun itu dipakai menghitung ringkasan holding
  (`investment-holding-math.ts`), baris yatim ini ikut kehitung padahal
  transaksi sumbernya sudah bukan investment lagi secara semantik.
- Kasus simetris yang BELUM dicoba tapi kemungkinan besar sama parah: debt
  → investment (baris `debts`/`debt_payments` yatim), dan investment ↔ debt
  dua arah lainnya.

## Status

**DIPERBAIKI (2026-10-15) DAN TERUJI PENUH runtime (2026-10-16)** — lihat
[docs/todos/done/unify-direct-writeoff-into-main-transaction-form.md](../../apps/desktop/docs/todos/done/unify-direct-writeoff-into-main-transaction-form.md)
bagian "Update 2026-10-15 (lanjutan) — Bug ganti pasangan akun lintas
domain" dan "Update 2026-10-16" untuk detail lengkap fix + verifikasi.
Ringkasnya:

- Fix: `cleanupStaleDomainOnAccountChange` (desktop & Worker, dipanggil
  SEBELUM percabangan `type`/pairKind) — bersihkan baris turunan
  (`debts`/`investment_purchases`/`investment_sales`) dari domain LAMA
  begitu keterlibatan domain itu BENAR-BENAR hilang setelah akun diganti.
- Diuji ulang 2026-10-16 persis skenario asli dokumen ini (cash→investment
  diedit jadi cash→debt) — `investment_purchases` lama terbukti hilang
  total (hard-delete di desktop), baris `debts` baru lahir benar.
- **Bug KEDUA ditemukan terpisah saat uji ulang**: gap simetris DI DALAM
  domain investment sendiri (purchase↔sale, bukan lintas investment↔debt)
  — dicatat & diperbaiki di dokumen plan yang sama, TIDAK ditulis ulang di
  sini karena bukan domain investment↔debt yang jadi judul dokumen ini.

## Catatan untuk ke depan

**Uji coba cross-type (ganti pasangan akun lintas domain saat edit) belum
pernah masuk skenario verifikasi manapun sebelum ini** — semua verifikasi
runtime sebelumnya (sesi 2026-10-14 sesi 1 & 2) selalu menguji SATU
kombinasi transfer per percobaan, tidak pernah mengedit transaksi yang
SAMA untuk berpindah antar kombinasi. Pola "edit transaksi X jadi kombinasi
A, lalu edit transaksi X YANG SAMA jadi kombinasi B" layak jadi skenario uji
coba standar untuk SEMUA perubahan di jalur Update transfer, karena baris
turunan (`debts`/`investment_purchases`/`investment_sales`) masing-masing
dikelola terpisah dan tidak ada yang secara eksplisit "membersihkan sisa
domain lain" saat pairKind berpindah domain.

**Perbaikan yang mungkin:** sebelum memilih cabang berdasarkan pairKind
BARU, cek dulu apakah transaksi ini punya baris turunan dari domain LAIN
(`getTransactionInvestmentPurchaseRow`/`getTransactionInvestmentSale`/query
debt serupa) dan bersihkan (soft-delete atau hard-delete + `pushDeleteOnWrite`)
kalau pairKind baru sudah tidak cocok dengan domain baris itu — pola yang
sama dengan bagaimana `applyInvestmentTransactionEdit` sudah menangani
delete-lalu-recreate untuk baris investment miliknya sendiri, tinggal
diperluas lintas domain (investment ⇄ debt), bukan cuma dalam satu domain
(investment → investment lagi).

# Edit unit pembelian investasi yang sudah terjual sebagian bisa membuat sisa unit akun negatif

Ditemukan saat menguji checklist "edit field berbahaya untuk transaksi
direct debt/investment" di
[docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md](../../apps/desktop/docs/todos/plan/unify-direct-writeoff-into-main-transaction-form.md).
Debt sudah punya proteksi `DebtEditBlockedError` (`hasPayments`), tapi
investment belum punya proteksi serupa sama sekali — pertanyaan "apakah
investment punya field berbahaya?" memicu pengecekan kode, yang
menemukan gap ini sebelum sempat dibuktikan lewat dogfooding.

## Bagaimana ketahuan

1. Transfer cash → akun investment ("Investasi Baru", unit 10, harga
   per unit 10000) — baris `investment_purchases` lahir, `status:
   settled`.
2. Transfer investment → cash ("Jual Investasi", unit 22, harga jual
   per unit 13000-an) dari akun yang sama (yang sudah punya total
   holding 33 unit dari pembelian-pembelian sebelumnya) — baris
   `investment_sales` lahir, `average_cost_per_unit`/`realized_pl`
   tersimpan sebagai snapshot. Total purchased 33, total sold 26
   (termasuk penjualan-penjualan lain sebelumnya).
3. **Edit "Investasi Baru"** (langkah 1) — turunkan `unit` dari 10 jadi
   2. Submit **BERHASIL tanpa error apa pun**.
4. Dicek lewat SQL
   (`docs/rules/checking-dev-database.md`): total purchased turun
   jadi 25, total sold tetap 26 — `getRemainingUnit` (
   `investment-holding-math.ts`) jadi **`25 - 26 = -1`**, NEGATIF.
   `average_cost_per_unit` LIVE (dihitung ulang dari seluruh
   `investment_purchases` settled saat ini) jadi berbeda dari snapshot
   yang sudah tersimpan permanen di baris `investment_sales` dari
   langkah 2 — representasi holding tidak konsisten secara retroaktif.

## Root cause

`applyInvestmentTransactionEdit`
(`shared/investments/apply-investment-transaction/edit.ts`) sebelum
fix tidak punya validasi apa pun terkait `getRemainingUnit` — field
`unit`/`price_per_unit` cuma divalidasi terhadap NOMINAL TRANSFER (satu
baris yang sama, sengaja longgar sesuai filosofi "tidak menghakimi
data" di `konsep-investasi.md`), tapi tidak ada yang mengecek efeknya
ke penjualan-penjualan LAIN yang sudah terjadi setelahnya.

Efek sampingan (bukan bug baru, tapi konsekuensi): karena
`InsufficientInvestmentUnitsError` (validasi oversell penjualan,
`apply-sell-investment-transaction.ts`) membandingkan `unit > remainingUnit`,
begitu `remainingUnit` sudah negatif, percobaan JUAL unit baru apa pun
(> 0) otomatis tertolak — tapi pesan errornya akan menyebut "sisa unit:
-1" yang membingungkan user (tidak menjelaskan AKAR masalahnya: edit
pembelian lama, bukan jual yang sedang dicoba).

## Dampak

- Representasi "sisa unit yang bisa dijual" bisa jadi negatif tanpa
  peringatan — ditampilkan apa adanya di UI (tidak ada guard tampilan).
- Average cost live "drift" dari snapshot historis yang sudah final —
  dua sumber kebenaran yang sebelumnya dijamin konsisten (lihat komentar
  `getAverageCostPerUnit`: "SATU-SATUNYA sumber rumus ini... supaya
  ketiganya TIDAK PERNAH bisa drift satu sama lain") jadi bisa berbeda
  secara retroaktif kalau pembelian lama diedit begini.
- Worker (`apps/worker/src/modules/investments/service.ts`,
  `applyInvestmentTransactionEdit`) punya pola IDENTIK — gap sama
  berlaku juga untuk jalur MCP.

## Status

**DIPERBAIKI (2026-10-16), TERUJI runtime di desktop.**
`InvestmentPurchaseEditBlockedError` baru:

- **Desktop** (`apply-investment-transaction/edit.ts`): validasi HANYA
  berlaku kalau baris lama berstatus `settled` (baris `pending` tidak
  pernah ikut `getRemainingUnit`, jadi tidak ada resiko). Hitung
  `remainingUnitExcludingThis` = `getRemainingUnit(existing.account_id)
  - existing.unit` (sisa unit akun TANPA kontribusi baris ini), lalu
  tambahkan kontribusi SETELAH diedit (0 kalau status baru jadi
  `pending`/bukan `settled`, unit baru kalau tetap `settled`) — tolak
  kalau hasilnya negatif. Catatan: `existing.account_id` dipakai (bukan
  `accountId`/`transferAccountId` dari input) karena makna kedua field
  itu berbeda tergantung `type` transaksi (untuk transfer cash→investment,
  akun investment adalah `transferAccountId`, bukan `accountId`) — bug
  kecil sempat ditemukan & diperbaiki sendiri saat menulis test unit.
- **Worker** (`investments/service.ts`): `validateInvestmentPurchaseEdit`,
  precheck reject-sebelum-tulis (pola sejajar `validateInvestmentSaleUnits`
  yang sudah ada), dipanggil dari `transactions/service.ts` SEBELUM
  UPDATE baris `transactions`.

Diverifikasi ulang di `tauri dev`: edit "Investasi Baru" naikkan unit
dari 2 balik ke 10 (MEMPERBAIKI holding) berhasil tanpa error (sisa
unit kembali positif, 33-26=7); edit turunkan lagi dari 10 jadi 2
(MEMPERBURUK) DITOLAK dengan toast jelas, dikonfirmasi lewat query
database tidak ada perubahan tersimpan sama sekali. `tsc` bersih
(desktop & Worker), 248 test vitest desktop lulus (2 baru).

**Belum diuji**: skenario ini via Worker/MCP (precheck
`validateInvestmentPurchaseEdit` belum diuji manual, baru dicek lewat
`tsc` + baca kode — pola sama seperti bug ketiga/self-settlement yang
juga baru diverifikasi di desktop).

## Catatan untuk ke depan

**Pola "proteksi hilang di domain investment yang analog dengan domain
debt" ini kemungkinan bukan satu-satunya** — debt sudah lebih dulu
punya proteksi matang (`DebtEditBlockedError`, `hasPayments`,
`DebtSelfSettlementError`) karena konsep "cicilan" sudah lama ada;
investment baru benar-benar diuji lewat jalur form transaksi utama
di sesi-sesi ini (2026-10-15/16). Kalau ada perubahan lain ke
`applyInvestmentTransactionEdit`/`applySellInvestmentTransactionEdit`
di masa depan, layak ditanya ulang: "apakah ada efek lintas-baris/waktu
serupa yang belum terpikirkan?" — jangan asumsikan filosofi "tidak
menghakimi data" otomatis berlaku untuk SEMUA kasus investment, itu
spesifik untuk konsistensi SATU baris saat input, bukan untuk
integritas riwayat transaksi lain yang sudah final.

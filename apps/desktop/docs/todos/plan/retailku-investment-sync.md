# Sync Investasi dari Retailku

> **Status: BLOCKED** — didahului `account-type.md` (belum diimplementasikan
> sama sekali, `accounts.account_type` saat ini cuma `'cash'`/`'debt'`, lihat
> migrasi `0013_account_type.sql`). Dokumen ini BARU catatan eksplorasi/temuan
> awal, BUKAN rencana implementasi siap jalan.

## Latar belakang

Dicek langsung lewat MCP "Warung Aqil": ada tool `get_investment_list`/
`get_investment_detail` yang sama sekali belum tersentuh sync `financial-app`
manapun (beda dari cashflow/AR-AP, lihat `retailku-cashflow-sync.md` dan
`retailku-account-mapping.md`).

## Temuan dari data nyata

**`get_investment_list`** (total 124 transaksi saat dicek, 2026-09-22):
- Semua bertipe `BUY` (tipe lain di skema: `REDEEM`, `OPENING_BALANCE`),
  status campuran `PENDING`/`POSTED` (`CANCELLED` juga ada di skema)
- Polanya auto-invest harian Rp10.000, `cashAccount` = Seabank (kode 1102),
  `investmentAccount` = "Bahana Liquid Syariah Kelas G" (kode 1201)
- Field lain per baris: `amount`, `capitalAmount`, `gainLoss`, `journalEntryId`
  (null selama masih `PENDING`), `revisedFromId` (revisi transaksi)

**`get_finance_accounts`** — akun terkait investasi:

| Kode | Nama | isInvestmentAccount | Role mapping |
|---|---|---|---|
| 1200 | Aset Investasi (header) | false | — |
| 1201 | Bahana Liquid Syariah Kelas G | **true** | — |
| 1180 | Dana Dalam Perjalanan - Investasi | false | `INVESTMENT_TRANSIT_BUY` |
| 1181 | Dana Dalam Perjalanan - Pencairan | false | `INVESTMENT_TRANSIT_REDEEM` |

Saat ini cuma ada **satu** akun `isInvestmentAccount: true` di toko ini.

**Sudah ada type definition di kode**, tapi TIDAK PERNAH dipakai:
`RetailkuFinanceAccount.isInvestmentAccount` di
`shared/retailku/mcp-tools/get-finance-accounts.ts` — field-nya ikut dibaca
dari MCP (karena ambil seluruh response), tapi tidak ada logic manapun yang
memfilter/mencabangkan berdasarkan flag ini.

## Efek TIDAK LANGSUNG yang sudah terjadi lewat cashflow sync

Transaksi BUY investasi keluar dari akun kas `isTrackedAsset` (Seabank), jadi
outflow-nya **ikut tersapu** oleh cashflow sync yang sudah ada
(`get_cashflow_detail`, lihat `retailku-cashflow-sync.md`) — tapi cuma
sebagai "uang keluar dari Seabank" generik (sourceType kemungkinan
`INVESTMENT_TRANSACTION`, sudah disebut di daftar sourceType penggerak kas di
`retailku-cashflow-sync.md` keputusan #1, tidak pernah diverifikasi khusus).
Nilai/saldo investasinya sendiri (unit, harga, gain/loss reksadana) TIDAK
tercermin di `financial-app` sama sekali.

## Kenapa BLOCKED, bukan sekadar "belum dikerjakan"

Skema `accounts` (`0013_account_type.sql`) cuma mendukung `account_type IN
('cash', 'debt')`. Menambah varian mengubah CHECK constraint yang sudah ada —
SQLite tidak izinkan `ALTER` langsung, wajib migration "copy-and-rename"
(lihat catatan di `account-type.md`). Sync investasi yang benar (bukan
sekadar numpang di cashflow) butuh minimal:

- `account_type = 'investment'` (atau sejenis) supaya akun investasi bisa
  dibedakan dari akun kas biasa di UI (`features/accounts/`, pie chart, dst)
- Kemungkinan tabel detail terpisah (`investment_accounts`?) untuk field
  seperti unit/harga per unit — pola yang sudah diantisipasi di
  `account-type.md` ("Tabel detail terpisah per tipe")
- Keputusan desain baru: apakah "BUY" investasi dicatat sebagai transfer
  cash→investment (mirip pola debt di `retailku-account-mapping.md`), atau
  bentuk lain — belum dibahas sama sekali di sini

`account-type.md` sendiri masih berstatus "Belum diputuskan" untuk daftar
final tipe akun dan field spesifiknya — jadi dokumen ini menunggu keputusan
di sana lebih dulu, bukan sesuatu yang bisa dikerjakan sejajar/independen.

## Di luar cakupan dokumen ini (untuk saat ini)

Semua langkah implementasi konkret (migrasi, mapping akun investasi, fungsi
sync, UI) — sengaja tidak dirinci di sini karena bergantung pada keputusan
`account-type.md` yang belum ada. Lanjutkan dokumen ini (atau tulis ulang)
SETELAH `account-type.md` punya keputusan final.

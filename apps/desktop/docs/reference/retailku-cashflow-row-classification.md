# Klasifikasi baris `get_cashflow_detail` Retailku

> **Referensi hidup** — dokumen ini adalah rujukan: baris cashflow dari
> Retailku itu diklasifikasikan APA dan KENAPA. Update di tempat setiap
> kali ada kategori baru/berubah.

## Kenapa klasifikasi ini ada

`sourceType` (SALE, FUND_TRANSFER, dst) SENDIRIAN tidak cukup untuk
menentukan peran ekonomi satu baris cashflow — satu `sourceType` yang
sama bisa menghasilkan baris dengan peran berbeda (dibuktikan lewat
data nyata, lihat tiap bagian di bawah). Klasifikasi dilakukan PER
BARIS individual, berdasarkan kombinasi `sourceType` + flag lain
(`isReceivablePayableAccount`, `isProviderPayoutAccount`,
`consignmentPayablePortion`, dst), bukan `sourceType` saja.

## Ringkasan

| Kombinasi `sourceType` + sinyal | Klasifikasi | Status |
|---|---|---|
| `isReceivablePayableAccount: true` (akun berperan piutang/utang) | `ar-ap` | Final |
| `SALE` + `isProviderPayoutAccount: true` | `provider-payout` | Final |
| `SALE` + `consignmentPayablePortion > 0` | `consignment` | Final |
| `FUND_TRANSFER` | `transfer` | Final |
| `INVESTMENT_TRANSACTION` | `transfer` | Sementara — menumpang sampai financial-app punya tipe akun investasi sendiri |
| `CASH_OPNAME` | `generic` | Final |
| `PURCHASE_ORDER` | `generic` | Final |
| `DIRECT_PURCHASE` / `PURCHASE_RECEIVING` (tanpa AR/AP) | `generic`, tapi bawa `itemTypes` | Diklasifikasikan sbg generic, `itemTypes` blm dipakai jalur khusus |
| `PURCHASE_RECEIVING` (dgn utang dagang, `payableAmount > 0`) | `ar-ap` | Final (tertangkap otomatis lewat `isReceivablePayableAccount`) |
| lainnya (SALE tanpa sinyal khusus, dst) | `generic` | Final |

## `generic`

Baris kas/bank biasa — bukan piutang/utang, bukan payout provider,
bukan consignment, bukan transfer/investasi. Ini fallback: semua baris
yang tidak match kategori lain di bawah jatuh ke sini.

## `ar-ap`

**Syarat**: `isReceivablePayableAccount === true`.

Akun piutang/utang toko — ditentukan dari ROLE akun (`AccountMapping.role`
di sisi Retailku: TRADE_RECEIVABLE, SUPPLIER_RECEIVABLE, OTHER_RECEIVABLE,
ACCOUNTS_PAYABLE, OTHER_PAYABLE, CONSIGNMENT_PAYABLE), BUKAN dari kode
akun — tiap toko BISA memetakan role itu ke kode akun berbeda, kode
1500/1700/1800/2100/2200/2300 yang sering terlihat di data cuma
konvensi/default onboarding, bukan yang dicek sistem. BUKAN akun
kas/bank, beda arti ekonomi dari net kas biasa.

**Contoh nyata**: `SL-260926-05` (26 Sept 2026) — baris "Hutang ke
Penitip" (role CONSIGNMENT_PAYABLE, kode akun toko ini 2300), credit
Rp 6.000, `receivablePayableDirection: "payable"`.

## `provider-payout`

**Syarat**: `isProviderPayoutAccount === true && sourceType === "SALE"`.

**Kenapa ada syarat `sourceType === "SALE"`** (bukan cuma
`isProviderPayoutAccount` sendirian): flag ini adalah atribut AKUN
(akun ini terdaftar sbg akun deposit provider PPOB), bukan atribut
TRANSAKSI — artinya SETIAP baris jurnal yang menyentuh akun provider
(mis. Seabank) akan bertanda `true`, apa pun `sourceType`-nya.
Dibuktikan nyata (26 Sept 2026): baris `FUND_TRANSFER`
(`TRF-260926-01`) dan `INVESTMENT_TRANSACTION` SAMA-SAMA punya
`isProviderPayoutAccount: true` di akun Seabank, padahal keduanya bukan
soal payout PPOB sama sekali. Tanpa syarat `sourceType === "SALE"`,
baris transfer/investasi itu akan salah tertangkap sebagai
`provider-payout`.

**Contoh nyata (payout PPOB sungguhan)**: `SL-260926-02` — baris
Seabank, credit Rp 9.700, `providerPayoutPortion: 9700`,
`productTypes: ["PPOB"]`.

**Field `providerPayoutPortion`** — porsi Rupiah dari transaksi SALE
yang mengalir ke provider PPOB (BUKAN pendapatan toko), dipisah dari
porsi consignment supaya tidak tercampur kalau satu transaksi punya
keduanya sekaligus.

## `consignment`

**Syarat**: `consignmentPayablePortion != null && consignmentPayablePortion > 0`.

Ini KHUSUS baris KAS di transaksi SALE yang mengandung item
consignment (bukan baris "Hutang ke Penitip" itu sendiri — itu sudah
tertangkap lebih dulu oleh `ar-ap`). Nilai `debit`/`credit` baris kas
ini MASIH UTUH (termasuk porsi consignment) — belum dikurangi jadi
pendapatan bersih toko.

**Field `consignmentPayablePortion`** — porsi Rupiah dari transaksi
SALE yang jadi utang ke penitip (BUKAN pendapatan toko), dipisah dari
porsi PPOB dengan alasan sama seperti `providerPayoutPortion`.

**Contoh nyata**: `SL-260926-05` — baris Kas Tunai, debit Rp 12.000,
`consignmentPayablePortion: 6000` (dikonfirmasi lewat detail
transaksi: item "Mainan Warung Gantung (Konsinyasi)", `totalCost:
6000`, PERSIS sama).

## `transfer`

**Syarat**: `sourceType === "FUND_TRANSFER" || sourceType === "INVESTMENT_TRANSACTION"`.

**`INVESTMENT_TRANSACTION` SEMENTARA ikut kategori ini** — financial-app
belum punya tipe akun investasi sendiri. Begitu ada, `INVESTMENT_TRANSACTION`
perlu dipisah jadi klasifikasi baru sendiri (mis. `"investment"`), TIDAK
terus menumpang di `transfer` selamanya. Lihat kandidat `account_type:
investment` di `docs/todos/plan/account-type.md`.

`FUND_TRANSFER` di Retailku bisa menghasilkan 2 ATAU 3 baris jurnal:
akun tujuan (debit), akun asal (credit), dan OPSIONAL akun beban fee
transfer kalau `fromFee`/`toFee` > 0. Baris fee ini kemungkinan besar
TIDAK lolos ke `get_cashflow_detail` (bukan akun kas/bank/piutang/
utang), tapi belum diverifikasi ke data nyata yang punya fee > 0.

**Contoh nyata (tanpa fee)**: `TRF-260926-01` — Kas Tunai (credit
500.000) ↔ Seabank (debit 500.000), `fromFee: 0`, `toFee: 0`.

## `DIRECT_PURCHASE` / `PURCHASE_RECEIVING`

**Bukan klasifikasi baru** — baris tanpa AR/AP tetap `generic`, baris
dengan utang dagang tetap tertangkap `ar-ap` lewat `isReceivablePayableAccount`
seperti biasa. Yang berubah: baris ini sekarang bawa `itemTypes`
(array `STOCK`/`SUPPLY`/`ASSET`/`RAW_MATERIAL`) — akun DEBIT dari
transaksi ini beda-beda tergantung tipe item (Persediaan Barang Dagang/
Beban Perlengkapan/Aset Tetap/Persediaan Bahan Baku), satu transaksi
bisa mengandung beberapa tipe sekaligus.

**`DIRECT_PURCHASE`** (pembelian tanpa PO) dan **`PURCHASE_RECEIVING`**
(penerimaan barang dari PO) SAMA-SAMA punya item ber-`itemType` — logic
penentuan akun debitnya IDENTIK di kedua sourceType (dikonfirmasi dari
kode sisi server), jadi satu field `itemTypes` mewakili keduanya, TIDAK
scoped ke satu sourceType saja (beda dari `productTypes` yang cuma
utk SALE).

**PENTING — `PURCHASE_RECEIVING` yang LUNAS PENUH via uang muka
(`payableAmount: 0`) TIDAK PERNAH muncul di `get_cashflow_detail` sama
sekali** — baik akun debit (Persediaan/Beban/Aset) maupun akun kredit
(Uang Muka Pembelian) BUKAN akun kas/bank/piutang/utang, jadi keduanya
gagal lolos filter akun `get_cashflow_detail`. Dibuktikan nyata: dari
12 `PURCHASE_RECEIVING` toko ini (Sept 2026), SEMUA `payableAmount: 0`
— tidak satupun muncul di `get_cashflow_detail` tanggal terkait,
walau jurnalnya benar-benar terposting (diverifikasi via `get_journal_list`
+ query langsung `journal_items`). `itemTypes` cuma relevan dibahas
kalau transaksi itu SENDIRINYA punya baris yang lolos filter.

**Contoh nyata (`PURCHASE_RECEIVING`, lolos filter via utang dagang)**:
`GR-260718-02` (18 Jul 2026) — baris "Hutang Dagang" (role
ACCOUNTS_PAYABLE), credit Rp 107.000, `itemTypes: ["SUPPLY"]`
(dikonfirmasi query jurnal langsung: debit ke akun `5500 Beban
Perlengkapan`).

**Contoh nyata (`DIRECT_PURCHASE`, lolos filter via kas)**: `DPB-260926-01`
— baris Kas Tunai, credit Rp 126.500, `itemTypes: ["STOCK"]`.

## `CASH_OPNAME`

Sudah final sbg `generic` (dibahas 2026-09-27): field `thirdPartyFunds`
(dana titipan yang tercampur fisik di kas) TIDAK PERNAH dijurnal
Retailku — dan itu BENAR secara akuntansi (dana itu bukan milik toko,
tidak masuk neraca toko). Baris cashflow yang keluar (`difference`)
sudah bersih, tidak perlu klasifikasi khusus. Kalau financial-app
suatu saat ingin mencatat dana semacam ini secara eksplisit, lihat
kandidat `account_type: third_party` di `docs/todos/plan/account-type.md`
— TIDAK mengubah klasifikasi CASH_OPNAME di sini.

## `PURCHASE_ORDER`

Sudah final sbg `generic`. Jurnal `PURCHASE_ORDER` HANYA soal uang
muka — debit ke satu akun tetap (role `PURCHASE_ADVANCE`, "Uang Muka
Pembelian"), credit ke metode pembayaran (+ opsional kredit supplier).
TIDAK PERNAH menyentuh akun `itemType`-spesifik (Persediaan/Beban/
Aset/Material) — item PO baru "direalisasikan" ke akun itu nanti saat
`PURCHASE_RECEIVING`, bukan saat PO dibuat/dibayar. Karena itu
`PURCHASE_ORDER` TIDAK bawa `itemTypes` (beda dari `DIRECT_PURCHASE`/
`PURCHASE_RECEIVING` di atas) — dikonfirmasi tidak ada relasi item PO
sama sekali di query sisi server.

Kandidat `account_type: advance` di `docs/todos/plan/account-type.md`
relevan di sini — uang muka itu levelnya "uang keluar tapi belum jadi
biaya/persediaan", bukan kas biasa. Tipe akun itu sendiri generik dua
arah (bukan spesifik pembelian) — `PURCHASE_ORDER` cuma salah satu
kasus pemakaiannya (sisi "kita bayar duluan"), lihat dokumen plan.

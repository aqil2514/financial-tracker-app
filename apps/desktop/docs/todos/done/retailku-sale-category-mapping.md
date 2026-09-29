# Mapping kategori penjualan (SALE) dari sync Retailku

> **Status: EKSPLORASI — belum ada rencana implementasi.** Dokumen ini
> mencatat TEMUAN dari data nyata (dicek langsung lewat MCP "Warung
> Aqil", 2026-09-23) soal kenapa memetakan `sourceType: "SALE"` ke satu
> kategori "Penjualan" secara naif akan SALAH untuk sebagian transaksi —
> bukan solusi siap jalan. Lanjutan dari pertanyaan: sync cashflow yang
> sudah ada (`retailku-cashflow-sync.md`, status SELESAI) TIDAK PERNAH
> mengisi `category_id` sama sekali (baik mode ringkas maupun detail) —
> mode detail cuma memisahkan baris per `sourceType` sebagai teks di
> `note`, bukan mapping ke kategori `financial-app`.

## Pertanyaan awal

User: "cashflow dari penjualan bisa dideteksi kan?" — lalu setelah
dikonfirmasi bisa (`sourceType: "SALE"` memang ada dan jelas), muncul
pertanyaan susulan yang jadi inti dokumen ini: **untuk kategori
PPOB dan CONSIGNMENT, apakah SEMUA baris cashflow-nya benar-benar murni
pendapatan/pengeluaran, atau ada campuran dengan transfer/utang-piutang
yang seharusnya TIDAK ikut masuk kategori "Penjualan"?**

Jawaban singkat, dikonfirmasi dengan 2 transaksi nyata + jurnal
lengkapnya: **TIDAK murni untuk keduanya, dengan pola kegagalan yang
BERBEDA** — lihat detail di bawah.

## Data sumber

Laporan `get_sales_by_type` periode 2026-09-01 s/d 2026-09-23:

| Tipe Produk | Qty | Omzet Bersih | Kontribusi |
|---|---|---|---|
| MERCHANDISE | 770 | Rp 956.500 | 62,8% |
| MANUFACTURE | 301 | Rp 304.500 | 20,0% |
| PPOB | 5 | Rp 131.000 | 8,6% |
| SERVICE | 29 | Rp 96.000 | 6,3% |
| CONSIGNMENT | 18 | Rp 36.000 | 2,4% |

**Catatan penting soal level data**: laporan ini per TIPE PRODUK (dalam
satu transaksi `SL-xxx` bisa campur beberapa tipe produk sekaligus,
lihat kedua contoh di bawah — keduanya transaksi campuran), sedangkan
cashflow sync bekerja di level `sourceType` cashflow (`"SALE"` untuk
SEMUA transaksi penjualan, apa pun isi produknya). **Breakdown per tipe
produk TIDAK tersedia di level cashflow sama sekali** — untuk tahu
"transaksi SALE ini ada PPOB-nya atau tidak", butuh `get_sale_detail`
per transaksi individual (item-level), bukan sekadar `get_cashflow_detail`.

## Kasus 1 — PPOB: DUA baris cashflow di DUA akun berbeda, sourceType SAMA

Transaksi `SL-260921-08` (Rp27.000, isi: Pulsa Listrik/PPOB + 4 item
merchandise). Jurnal lengkap (`get_journal_detail`):

| Akun | Debit | Kredit | Makna |
|---|---|---|---|
| 1101 Kas Tunai | 27.000 | — | Uang masuk dari customer |
| 5300 HPP PPOB | 21.780 | — | Beban harga pokok PPOB |
| 5100 HPP | 1.566,54 | — | Beban harga pokok merchandise |
| 1400 Persediaan Barang | — | 1.566,54 | Stok keluar |
| **1102 Seabank** | — | **21.780** | **Bayar ke provider PPOB — uang KELUAR** |
| 4100 Penjualan Retail | — | 4.000 | Pendapatan merchandise asli |
| 4200 Pendapatan PPOB | — | 23.000 | Pendapatan PPOB (harga jual pulsa) |

Dikonfirmasi lewat `get_cashflow_detail` (`dateFrom=dateTo=2026-09-21`):
baris "Seabank -21.780" **BENAR-BENAR MUNCUL** sebagai baris cashflow
terpisah, dengan `sourceType: "SALE"` dan `sourceNumber: "SL-260921-08"`
**PERSIS SAMA** dengan baris "Kas Tunai +27.000".

```json
{
  "date": "2026-09-21T10:26:28.821Z",
  "description": "Penjualan SL-260921-08",
  "sourceType": "SALE",
  "sourceNumber": "SL-260921-08",
  "accountId": "b9179630-...",   // Seabank
  "accountName": "Seabank",
  "debit": 0,
  "credit": 21780
}
```

**Konsekuensi**: satu `sourceType: SALE` bisa menghasilkan lebih dari
satu baris cashflow, DI AKUN BERBEDA, dengan MAKNA EKONOMI YANG
BERLAWANAN (satu pendapatan, satu pengeluaran/pembayaran ke pihak
ketiga). Kalau nanti dibuat mapping naif `sourceType → category_id`
(mis. "SALE selalu masuk kategori Penjualan"), baris Seabank -21.780
akan SALAH tercatat sebagai pendapatan penjualan, padahal itu
pengeluaran (bayar provider).

**Yang membedakan kedua baris SECARA MEKANIS**: `accountId` tujuannya.
Baris "pendapatan asli" masuk ke akun kas tempat customer bayar (Kas
Tunai/dsb), baris "bayar provider" masuk ke akun kas SUMBER pembayaran
provider (dalam kasus ini kebetulan Seabank). **Belum ada cara pasti
membedakan keduanya HANYA dari `get_cashflow_detail`** — perlu heuristik
tambahan (mis. akun yang di-`credit`/keluar dalam transaksi `SALE` yang
`debit`-nya juga ada di baris lain periode sama, kemungkinan itu
provider payout) yang BELUM diverifikasi robust untuk kasus umum (baru
1 sample transaksi dicek).

## Kasus 2 — Consignment: SATU baris cashflow, tapi mencampur pendapatan + titipan penitip

Transaksi `SL-260922-15` (Rp6.000, isi: 1 item Consignment + 3 item
merchandise). Jurnal lengkap:

| Akun | Debit | Kredit | Makna |
|---|---|---|---|
| 1101 Kas Tunai | 6.000 | — | Uang masuk (SATU-satunya baris kas) |
| 5100 HPP | 2.005,04 | — | Beban HPP merchandise |
| **2300 Hutang ke Penitip** | — | **1.500** | **Kewajiban ke penitip — BUKAN akun kas, tidak muncul di cashflow** |
| 4100 Penjualan Retail | — | 4.000 | Pendapatan merchandise asli |
| 4120 Pendapatan Komisi Konsinyasi | — | 500 | Pendapatan komisi (bukan penjualan penuh) |
| 1400 Persediaan Barang | — | 2.005,04 | Stok keluar |

Beda dari kasus PPOB: akun `2300 Hutang ke Penitip` **bukan akun
kas/bank** (`isTrackedAsset: false`), jadi `get_cashflow_detail` (yang
sumbernya "item jurnal pada akun kas/bank yang terposting", lihat
`retailku-cashflow-sync.md`) **TIDAK PERNAH menangkapnya sebagai baris
terpisah**. Baris "Kas Tunai +6.000" di cashflow sudah MENCAMPUR:
- Rp4.000 pendapatan merchandise asli (punya toko)
- Rp500 komisi konsinyasi (punya toko)
- Rp1.500 titipan uang milik penitip (WAJIB dibayarkan balik, ini
  liability, bukan pendapatan toko sama sekali)

**Konsekuensi**: TIDAK ADA CARA memisahkan porsi ini dari
`get_cashflow_detail` — datanya sudah tergabung sejak level jurnal jadi
satu baris kas. Memisahkannya butuh `get_sale_detail`/`get_journal_detail`
PER TRANSAKSI (tahu produk mana consignment, hitung komisinya, dst) —
level data yang JAUH lebih berat dibanding cashflow sync yang sudah ada
(yang sengaja dirancang ringan: 1-2 panggilan MCP per rentang tanggal,
bukan N panggilan per transaksi individual, lihat pertimbangan performa
di `retailku-cashflow-sync.md` keputusan #1).

## Perbandingan dengan temuan lama (kasus PPOB di `retailku-cashflow-sync.md`)

Dokumen lama (`retailku-cashflow-sync.md`, bagian "Kasus PPOB") sudah
membahas PPOB tapi dari SUDUT PANDANG BERBEDA — kasus yang dicek di
sana adalah **piutang** (`SL-260914-19`, pembayaran customer baru lunas
KEESOKAN HARINYA lewat `SALE_PAYMENT` terpisah), sehingga jeda waktu
antara "bayar provider" (hari H) dan "customer melunasi" (hari lain)
jadi concern utamanya. **Keputusan yang sudah diambil di sana**: TIDAK
"diperbaiki" — diterima sebagai trade-off, karena `financial-app`
sebagai pencatat kas (bukan P&L per-transaksi) memang tidak dirancang
menyatukan cerita income-expense berpasangan.

**Kasus yang dicek di dokumen INI berbeda**: transaksi PPOB yang
LANGSUNG LUNAS TUNAI (`SL-260921-08`, `paymentLines` langsung ke Kas
Tunai, bukan piutang) — jeda waktu BUKAN masalahnya di sini. Masalahnya
murni soal KATEGORISASI: baris Seabank -21.780 itu sendiri (terlepas
dari kapan dia terjadi) secara ekonomi BUKAN "penjualan", tapi kalau
di-mapping naif berdasarkan `sourceType` doang, akan ikut ke kategori
Penjualan.

Jadi kedua dokumen membahas SISI BERBEDA dari masalah yang sama
(transaksi PPOB menyentuh 2 akun kas) — dokumen lama soal TIMING
(kapan tiap baris terjadi), dokumen ini soal KATEGORISASI (apa arti
ekonomi tiap baris).

## Sampling lanjutan (2026-09-23) — pertanyaan #1 TERJAWAB

Verifikasi lewat 6 sample transaksi PPOB + 5 sample transaksi
Consignment (tersebar Agustus–September, campuran murni & campur
MERCHANDISE/MANUFACTURE, lewat `get_sale_detail` + `get_journal_detail`
per transaksi via MCP "Warung Aqil"). **Pola KONSISTEN di semua
sample, tidak ada anomali ditemukan** (tidak ada transaksi campuran
PPOB+Consignment, tidak ada baris kas terpisah untuk consignment).

**PPOB**: akun provider yang di-kredit SELALU "1102 Seabank" di seluruh
sample — tapi heuristik yang direkomendasikan BUKAN hardcode nama akun
itu, melainkan lebih general: **baris kredit pada akun berkategori
ASSET (bukan akun kas tempat customer bayar) yang nominalnya PERSIS
SAMA dengan `unitCost` item berproduct-type PPOB** di transaksi sumber
yang sama (dihubungkan lewat `sourceId`/`sourceNumber` journal →
`get_sale_detail`). Satu varian ditemukan: transaksi piutang
(`SL-260914-19`) memakai "1500 Piutang Dagang" di sisi debit customer
alih-alih kas langsung — polanya tetap sama, cuma sisi debit-nya bukan
kas tunai. Baris pendapatan asli SELALU masuk akun berkategori REVENUE
(4100/4120/4200).

**Consignment**: SELALU ada baris "2300 Hutang ke Penitip" berkategori
**LIABILITY** terpisah di jurnal (bukan akun kas) — heuristik ini unik
dan tidak pernah ambigu dengan baris REVENUE atau kas (ASSET, kode
1101). Baris kas SELALU satu baris gabungan (tidak pernah terpisah
untuk item consignment), termasuk saat transaksi campur dengan item
non-consignment lain.

**Peringatan penting ditemukan saat sampling**: nama produk BISA
MENYESATKAN untuk deteksi tipe secara manual — mis. "Mainan Warung
Gantung" (tanpa suffix) adalah MERCHANDISE biasa, beda dari "Mainan
Warung Gantung (Konsinyasi)" yang type-nya CONSIGNMENT. Kalau mapping
jadi dikerjakan, deteksi HARUS selalu berdasar field `product.type`
item, tidak boleh pakai nama produk sebagai proxy.

**Kesimpulan heuristik mekanis** (menjawab pertanyaan #1 lama di
bawah): membedakan baris ekonomi dalam satu jurnal `sourceType: SALE`
bisa dilakukan robust lewat **kategori akun** (REVENUE vs ASSET vs
LIABILITY), bukan nama akun spesifik — asalkan `get_journal_detail`
menyediakan kategori akun per baris (perlu dicek field-nya lebih
lanjut saat masuk fase desain implementasi).

## Implementasi field `isProviderPayoutAccount` — SELESAI di sisi server

**Diimplementasikan 2026-09-23** di `retail-multitenant` (server MCP
"Warung Aqil"), BUKAN di `financial-app` — pendekatan yang dipilih
setelah pertimbangan cakupan/biaya panggilan MCP (lihat bagian di
bawah): edit tool `get_cashflow_detail` yang sudah ada, BUKAN bikin
tool baru, karena MCP Retailku ini SATU-SATUNYA dipakai AI assistant
(termasuk `financial-app` sebagai konsumen), tidak ada kontrak/versi
ketat yang perlu dijaga, dan perubahan bersifat ADITIF (field baru,
tidak mengubah/menghapus field lama).

**Perubahan**:
- `get-cfr-detail.helper.ts`: tambah `prisma.provider.findMany({
  storeId, deletedAt: null })` PARALEL (`Promise.all`) dengan query
  journal entries yang sudah ada — bangun `Set<accountId>` dari
  `Provider.accountId`, lalu tiap baris hasil ditandai
  `isProviderPayoutAccount: providerAccountIds.has(item.account.id)`.
  **0 panggilan MCP tambahan** dari sisi konsumen — cuma 1 query Prisma
  ekstra yang murah di server.
- `get-cashflow-detail.ts` (registrasi tool): deskripsi tool diupdate
  supaya AI assistant tahu makna & cara pakai flag baru.
- `financial-app`: `RetailkuCashflowDetailRow` (`shared/retailku/mcp-tools/cashflow/get-cashflow-detail.ts`)
  ditambah field `isProviderPayoutAccount: boolean`.

**Sumber data**: `Provider.accountId` di skema `retail-multitenant`
(`provider.prisma`) — akun kas tujuan payout provider PPOB (mis.
Seabank) SUDAH tersimpan eksplisit per provider, TIDAK PERNAH perlu
ditebak dari nominal/nama akun seperti heuristik awal (lihat
"Sampling lanjutan" di atas — heuristik itu jadi TIDAK RELEVAN lagi,
digantikan field ini yang 100% akurat by design).

**Diverifikasi lewat panggilan `get_cashflow_detail` nyata**
(2026-09-23, `dateFrom=dateTo=2026-09-21`) — hasil SL-260921-08 persis
sesuai temuan sampling manual sebelumnya:
- `Kas Tunai +27.000` → `isProviderPayoutAccount: false` (pendapatan asli)
- `Seabank -21.780` → `isProviderPayoutAccount: true` (bayar provider)

**TEMUAN PENTING dari verifikasi — batasan cakupan flag ini**: flag
ini bekerja di LEVEL AKUN (`accountId ∈ Provider.accountId`), BUKAN
level transaksi/baris. Konsekuensinya, SEMUA baris cashflow yang lewat
akun Seabank ikut bertanda `isProviderPayoutAccount: true`, TERMASUK
yang `sourceType`-nya BUKAN `SALE` — dibuktikan pada tanggal yang sama
ada baris `INVESTMENT_TRANSACTION -10.000` dan `PURCHASE_ORDER
-39.679` di Seabank, KEDUANYA ikut `true` walau bukan pembayaran
provider PPOB sama sekali (kebetulan toko ini pakai Seabank juga untuk
investasi & pembayaran supplier).

**Implikasi untuk implementasi sync nanti**: flag ini HANYA valid
diandalkan dalam KONTEKS `sourceType: "SALE"` (untuk membedakan baris
pendapatan asli vs bayar-provider DALAM SATU transaksi SALE yang
sama) — TIDAK BOLEH dipakai sebagai penanda umum "exclude dari
kategori apa pun" di seluruh sourceType. Logic mode baru
("detail per transaksi", lihat pembahasan mode sync di bawah) WAJIB
mengecek `row.sourceType === "SALE"` DULU sebelum membaca
`isProviderPayoutAccount`, bukan langsung filter berdasar flag itu
saja.

## Implementasi field `productTypes` — SELESAI di sisi server (jawab Consignment)

**Diimplementasikan 2026-09-23**, menyusul `isProviderPayoutAccount` di
file/tool yang SAMA (`get-cfr-detail.helper.ts` +
`get-cashflow-detail.ts`). Field ini BEDA tujuan dari
`isProviderPayoutAccount` — bukan mengganti, melainkan melengkapi:
`isProviderPayoutAccount` khusus bantu PPOB (level akun), `productTypes`
GENERIK untuk semua `ProductType` (`MERCHANDISE`, `MANUFACTURE`,
`DIGITAL`, `PPOB`, `SERVICE`, `CONSIGNMENT`) yang terlibat di transaksi
sumber — konsumen yang memfilter tipe mana yang relevan untuk
kebutuhannya.

**Sebelum implementasi, diverifikasi dulu jalur relasinya ada**: cek
skema `retail-multitenant` — `JournalEntry` (sourceType SALE) punya
relasi 1:1 ke `SaleTransaction` (`journalEntryId`), yang punya relasi
1:N ke `SaleTransactionItem`, yang punya relasi N:1 ke `Product`
(field `type: ProductType`). Jalur relasi LENGKAP tersedia lewat
Prisma nested `select` — TIDAK PERNAH perlu panggilan MCP terpisah ke
`get_sale_detail` sama sekali.

**Dampak performa DIUKUR NYATA** (bukan cuma estimasi) sebelum
implementasi — `EXPLAIN ANALYZE` langsung ke `multi_retail_db`
(docker, storeId Warung Aqil, ~1.723 transaksi SALE riwayat penuh):
- Query baseline (tanpa join produk), rentang 9 bulan: **~5.1ms**
- Query + join `saleTransaction→items→product.type`, rentang SAMA:
  **~11-15ms**
- Semua join pakai INDEX SCAN (`sale_transactions_journalEntryId_key`
  unique index, `sale_transaction_items_saleTransactionId_idx`) — TIDAK
  ADA sequential scan tambahan pada tabel besar. Overhead ~7-10ms untuk
  SELURUH riwayat toko dianggap AMAN untuk dilanjutkan.

**Perubahan**:
- `get-cfr-detail.helper.ts`: tambah `saleTransaction: { select: {
  items: { select: { product: { select: { type: true } } } } } }` ke
  `select` query `journalEntry.findMany` yang sudah ada (bukan query
  terpisah) — lalu per entry, bangun `productTypes` dari
  `[...new Set(...)]` (dedupe tipe produk yang sama), `null` kalau
  `entry.saleTransaction` kosong (sourceType bukan SALE).
- `get-cashflow-detail.ts`: deskripsi tool diupdate lagi, jelaskan
  `productTypes` DAN batasannya untuk Consignment (baris "Hutang ke
  Penitip" tetap TIDAK PERNAH muncul di sini, `productTypes` cuma kasih
  SINYAL "transaksi ini ada CONSIGNMENT", bukan pemisahan nilai
  otomatis).
- `financial-app`: `RetailkuCashflowDetailRow` ditambah
  `productTypes: string[] | null`.

**Diverifikasi lewat panggilan `get_cashflow_detail` nyata**
(2026-09-23, `dateFrom=dateTo=2026-09-21`, SETELAH restart server) —
SL-260921-08 (sample PPOB+MERCHANDISE campuran):
- Kedua baris (Kas Tunai +27.000 DAN Seabank -21.780) sama-sama
  `productTypes: ["PPOB", "MERCHANDISE"]` — BENAR, karena keduanya dari
  `sourceNumber` yang sama, field ini level TRANSAKSI bukan level
  baris/akun (beda dari `isProviderPayoutAccount` yang level akun).
- Baris non-SALE (`INVESTMENT_TRANSACTION`, `CASH_OPNAME`,
  `PURCHASE_ORDER`) semuanya `productTypes: null` — SESUAI ekspektasi,
  karena field ini baru join ke `saleTransaction` (PURCHASE/investasi
  belum digarap, di luar cakupan sesi ini).

**Status pertanyaan #2 lama (Consignment) — REVISI, awalnya dianggap
TIDAK BISA, ternyata BISA**: field `productTypes` di atas cuma
sinyal keberadaan, TAPI kemudian ditemukan (lihat bagian
`nonRevenuePortion` di bawah) bahwa pemisahan NILAI presisi (bukan
cuma sinyal) TERNYATA MEMUNGKINKAN — `unitCost`/`totalCost` yang
SUDAH tersimpan permanen di `SaleTransactionItem` untuk item
CONSIGNMENT sama persis dengan nilai "Hutang ke Penitip" di jurnal,
TIDAK PERLU `commissionAmountPerBase` dari tabel consignment terpisah
seperti dugaan awal di sini.

## Implementasi field `nonRevenuePortion` — SELESAI (jawab TUNTAS pertanyaan #2)

**Diimplementasikan 2026-09-23**, di file/tool yang SAMA. Dipicu dari
pertanyaan user: "misal ada lebih dari 1 item transaksi dan tercampur,
ini belum bisa dihandle?" — jawabannya: untuk PPOB SUDAH aman (nilai
sudah terpisah alami di jurnal per akun provider, tidak peduli
campuran), tapi untuk CONSIGNMENT awalnya memang belum (cuma sinyal
`productTypes`, bukan nilai). Digali lebih lanjut apakah PEMISAHAN
NILAI Consignment memungkinkan dari sisi Retailku.

**Temuan kunci** (`create-validate-items.ts` baris 122-129,
`create-journal.ts` baris 260-278): untuk item CONSIGNMENT,
`unitCost = unitPrice - commissionAmountPerBase` — ARTINYA
`commissionAmountPerBase` (dan karenanya nilai "Hutang ke Penitip")
BISA DIREKONSTRUKSI BALIK dari `unitPrice`/`unitCost` yang SUDAH
tersimpan permanen di `SaleTransactionItem`, TANPA perlu tabel
`ConsignmentReceivingItem`/`ConsignmentStockLog` sama sekali. Pola
yang SAMA berlaku untuk PPOB (`unitCost` = harga beli dari provider).

**Diverifikasi lewat query nyata ke `multi_retail_db`** (docker,
storeId Warung Aqil) — transaksi `SL-260904-14` (Consignment, qty 6,
unitPrice 2000, unitCost 1500): `totalCost` tersimpan = **9000**,
dicocokkan ke `get_journal_detail` transaksi yang sama → baris
"Hutang ke Penitip" = **9000 persis**. `totalPrice - totalCost` = 3000
= persis nilai "Pendapatan Komisi Konsinyasi" di jurnal yang sama.
Rumus: **`hutangPenitip = totalCost`**, **`komisiKonsinyasi =
totalPrice - totalCost`** — akurat 100%, bukan estimasi.

**Perubahan**:
- `get-cfr-detail.helper.ts`: `select` pada `saleTransaction.items`
  diperluas ikut ambil `totalPrice`+`totalCost` (sebelumnya cuma
  `product.type`). Field baru `nonRevenuePortion`: jumlah `totalCost`
  KHUSUS item ber-`productType` PPOB atau CONSIGNMENT (`NON_REVENUE_
  PRODUCT_TYPES` — sengaja TIDAK termasuk MERCHANDISE/MANUFACTURE/dst,
  karena `totalCost` tipe itu berarti HPP toko sendiri, BUKAN "mengalir
  ke pihak ketiga" — beda makna, tidak boleh digabung dalam jumlah
  yang sama). `null` kalau bukan SALE atau tidak ada item PPOB/
  CONSIGNMENT sama sekali (dibedakan dari `0` yang berarti "dicek,
  memang nihil"). Tetap TIDAK ADA query/panggilan MCP tambahan — cuma
  memperluas `select` yang sudah ada.
- `get-cashflow-detail.ts`: deskripsi tool diupdate, SEKALIGUS
  mengoreksi klaim lama yang bilang Consignment "tidak bisa dipisah
  dari data cashflow" (sekarang BISA, lewat field ini).
- `financial-app`: `RetailkuCashflowDetailRow` ditambah
  `nonRevenuePortion: number | null`.

**Diverifikasi lewat panggilan `get_cashflow_detail` nyata**
(2026-09-23, setelah restart server):
- `SL-260921-08` (PPOB, kedua baris Kas Tunai & Seabank):
  `nonRevenuePortion: 21780` — PERSIS sama dengan nilai baris jurnal
  "Seabank -21.780" yang sudah diverifikasi sebelumnya.
- `SL-260904-16` (Consignment, `productTypes: ["CONSIGNMENT"]`,
  `debit: 4000`): `nonRevenuePortion: 3000` — cocok dengan sample
  perhitungan manual (`totalCost` tersimpan = 3000).
- Pendapatan bersih toko per baris = `debit`/`credit` **dikurangi**
  `nonRevenuePortion` — utk SL-260904-16: 4000 - 3000 = **1000**
  (murni komisi konsinyasi toko, BUKAN termasuk nilai barang penitip).
- Baris non-SALE tetap `nonRevenuePortion: null`, TIDAK ADA regresi.

**KESIMPULAN — pertanyaan terbuka #1 DAN #2 (versi lama, di bawah)
SUDAH TERJAWAB TUNTAS** oleh 3 field ini
(`isProviderPayoutAccount`+`productTypes`+`nonRevenuePortion`), TANPA
panggilan MCP tambahan sama sekali, TANPA heuristik berbasis nominal/
nama akun yang rapuh. Yang BELUM diputuskan sekarang murni soal
PEMANFAATAN di sisi `financial-app` (pertanyaan #3/#4 lama: prioritas
dikerjakan sekarang vs nanti, desain skema mapping category_id kalau
jadi — BUKAN LAGI soal "bisa/tidak bisa" secara teknis).

### Lampiran — data mentah sample (dicatat supaya tidak perlu query ulang MCP)

Semua dicek lewat `get_sale_detail` + `get_journal_detail`, MCP "Warung
Aqil", 2026-09-23. Kolom "Kesimpulan" ringkas pola per transaksi.

**PPOB (6 transaksi):**

| Nomor | Produk PPOB | Sisi debit customer | Provider dikredit | Kesimpulan |
|---|---|---|---|---|
| SL-260921-10 | Paket Data | 1101 Kas Tunai | 1102 Seabank (=cost) | Konsisten (pola baku) |
| SL-260914-19 | Pulsa Listrik | **1500 Piutang Dagang** (bukan kas) | 1102 Seabank (=cost) | Varian: debit via piutang, bukan kas langsung |
| SL-260911-10 | Paket Data | 1101 Kas Tunai | 1102 Seabank (=cost) | Konsisten |
| SL-260827-02 | Paket Data | 1101 Kas Tunai | 1102 Seabank (=cost) | Konsisten |
| SL-260825-02 | Pulsa Listrik + MERCHANDISE campur | 1101 Kas Tunai | 1102 Seabank (=cost PPOB saja) | Konsisten, baris retail (4100+HPP) tetap terpisah normal |
| SL-260821-20 | Pulsa Listrik | 1101 Kas Tunai | 1102 Seabank (=cost) | Konsisten |

Struktur baku jurnal PPOB: debit Kas/Piutang (=harga jual) + debit
"5300 HPP PPOB" (=cost) + kredit "4200 Pendapatan PPOB" (=harga jual)
+ kredit "1102 Seabank" (=cost, ASSET, ini baris "bukan pendapatan").

**Consignment (5 transaksi):**

| Nomor | Isi | Hutang ke Penitip | Baris kas | Kesimpulan |
|---|---|---|---|---|
| SL-260922-15 | Consignment + MERCHANDISE | 2300, Rp1.500 | 1 baris gabungan (Kas Tunai +6.000) | Konsisten (sample awal) |
| SL-260910-05 | Consignment + MERCHANDISE | 2300, ada | 1 baris gabungan | Konsisten |
| SL-260918-16 | Consignment + MERCHANDISE | 2300, ada | 1 baris gabungan | Konsisten |
| SL-260918-12 | Consignment + MANUFACTURE | 2300, ada | 1 baris gabungan | Konsisten |
| SL-260916-04 | Consignment murni (qty 2) | 2300, ada | 1 baris gabungan, TANPA baris HPP retail (tidak ada barang sendiri terjual) | Konsisten |

Struktur baku jurnal Consignment (per unit): "2300 Hutang ke Penitip"
(LIABILITY, Rp1.500/unit) + "4120 Pendapatan Komisi Konsinyasi"
(REVENUE, Rp500/unit, margin tetap) + baris kas gabungan mencakup
SEMUA item transaksi (bukan cuma consignment).

**Catatan produk yang sempat salah duga**: "Mainan Warung Gantung"
(polos) = MERCHANDISE; "Mainan Warung Gantung (Konsinyasi)" =
CONSIGNMENT. "Mainan Kado-kadoan" = MERCHANDISE (bukan consignment,
walau sempat diduga dari nama). Deteksi type WAJIB dari field
`product.type` / `items[].productType`, bukan dari nama produk.

**Sample TIDAK ditemukan**: transaksi campuran PPOB+Consignment
sekaligus dalam satu `SL-`; baris kas terpisah untuk item consignment.
Kalau butuh sample tambahan di kemudian hari, cek dulu apakah
kombinasi ini sudah pernah terjadi lewat `get_sales_by_type` per
periode sebelum query manual ke `get_sale_detail`.

## Pertanyaan terbuka lama (untuk konteks histori)

1. ~~**PPOB — bagaimana membedakan baris "pendapatan asli" vs "bayar
   provider" secara robust?**~~ **TERJAWAB** lewat sampling di atas.
2. **Consignment — apakah perlu diselesaikan sama sekali dari sisi
   cashflow, atau ini memang di luar jangkauan cashflow sync by
   design?** Opsi yang belum dieksplorasi: biarkan cashflow sync apa
   adanya (kas gabungan, sesuai desain saat ini), dan selesaikan
   pemisahan pendapatan vs titipan penitip lewat jalur LAIN (mis. sync
   `get_consignment_settlement_list` terpisah, di luar cashflow) —
   pola serupa "sync AR/AP terpisah dari cashflow" yang sudah dipakai
   untuk `get_ar_ap`.
3. **Skala masalah**: PPOB+Consignment cuma 11% dari kontribusi omzet
   (8,6% + 2,4%) di sample bulan ini — apakah ini prioritas tinggi
   untuk diselesaikan, atau `category_id` biarkan kosong untuk semua
   hasil sync (seperti sekarang) dan user assign manual untuk kasus
   minor ini?
4. **Kalau mapping kategori jadi dikerjakan**: perlu desain skema baru
   (tabel mapping sourceType→category_id, mirip `retailku_account_mapping`)
   dan keputusan UI (tab baru di Konfigurasi, atau bagian dari mapping
   akun yang sudah ada?) — BELUM dibahas sama sekali di dokumen ini.

## Di luar cakupan dokumen ini (untuk saat ini)

Tidak ada rencana implementasi konkret (migrasi, fungsi mapping, UI) —
sengaja belum ditulis karena pertanyaan #1-#4 di atas belum dijawab.
Lanjutkan dokumen ini (atau tulis dokumen implementasi terpisah)
SETELAH ada keputusan untuk pertanyaan-pertanyaan itu.

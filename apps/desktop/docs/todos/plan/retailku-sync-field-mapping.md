# Mapping field non-fakta hasil sync Retailku (menggantikan `retailku_account_mapping`)

> **Status: DISEPAKATI untuk mode summary+detail, siap implementasi.**
> Mode ketiga (breakdown PPOB/Consignment, lihat
> `retailku-sale-category-mapping.md`) BELUM masuk skema ini — akan
> dikembangkan terpisah sambil skema ini sudah berjalan produksi
> beberapa hari untuk mode summary/detail.

## Latar belakang

Sync cashflow yang sudah ada (`retailku-cashflow-sync.md`, status
SELESAI) TIDAK PERNAH mengisi `category_id` transaksi hasil sync, dan
field `note` selalu digenerate dari template hardcoded di kode
(`aggregate-by-date-and-account.ts`: `` `Ringkasan Kas Harian Retailku
— ${accountName}` ``, `aggregate-by-date-account-and-source-type.ts`:
`` `Kas Harian Retailku — ${accountName} — ${sourceType}` ``). Kalau
user mau judul transaksi berbeda (mis. "Hasil dari Retailku" vs "Uang
Masuk Retailku"), satu-satunya cara sekarang adalah edit manual per
transaksi setelah sync — tidak bisa diatur sekali untuk semua sync ke
depan.

**Tujuan dokumen ini**: setiap baris hasil agregasi (`AggregatedTotal`)
diberi satu **key** stabil (tanpa tanggal/nominal — cuma "jenis"
barisnya). Key itu jadi lookup ke tabel mapping baru yang user atur
SEKALI di awal, isinya field-field NON-FAKTA transaksi (note,
category_id, description) — kalau user belum atur untuk suatu key,
fallback ke default (behavior sekarang, TIDAK breaking).

## Kenapa ini dianggap MENGGANTIKAN `retailku_account_mapping`, bukan tabel tambahan independen

Ditemukan lewat diskusi: pertanyaan mendasar tiap mode sync bisa
dibunyikan sebagai *"Total sebanyak ini, [atribut sesuai mode], masuk
ke mana?"*

- **Mode summary**: "Total X, masuk akun mana?" — 1 dimensi (akun).
  `retailku_account_mapping` (akun Retailku → akun lokal) SUDAH persis
  menjawab pertanyaan ini.
- **Mode detail**: "Total X, sourceType-nya apa, masuk akun mana?" — 2
  dimensi (akun + sourceType).

`retailku_account_mapping` yang sekarang cuma urus 1 dimensi (akun) —
itu KASUS KHUSUS dari kebutuhan yang lebih umum. Solusi yang dipilih:
SATU tabel mapping baru yang levelnya per-key (mencakup akun DAN
sourceType/arah sesuai mode), bukan dua tabel terpisah yang tanggung
jawabnya tumpang tindih.

**PENTING — pembagian tanggung jawab TETAP terpisah secara konsep**,
walau digabung ke satu tabel: akun tujuan (`local_account_id`) itu
WAJIB diisi (tanpa itu sync tidak tahu ke mana insert transaksi
lokal — baris `unmapped-account` di-skip). Field non-fakta (note,
category_id, description) itu OPSIONAL dengan default. Tabel baru
menyatukan keduanya per-key karena key SUDAH mengandung identitas akun
di dalamnya (lihat bentuk key di bawah) — bukan mencampur adukkan
"wajib" dan "opsional" jadi tidak jelas, kolom akun tetap `NOT NULL`,
kolom lain tetap nullable.

## Field FAKTA vs NON-FAKTA

**FAKTA** (selalu dari data mentah Retailku, TIDAK PERNAH di-mapping):
- `amount` (dari `net` hasil agregasi)
- `date`
- `type` — derivable dari arah net (positif→income, negatif→expense),
  TETAP otomatis meski secara teori bisa di-override (tidak masuk akal
  untuk kasus ini, sengaja tidak dibuka)
- `source`, `source_ref` — housekeeping internal sync

**NON-FAKTA** (bisa dikustomisasi lewat mapping, fallback ke default
per KOLOM independen kalau user belum isi — bukan per baris/key
keseluruhan):
- `note`
- `category_id`
- `description`
- `account_id` — SEDIKIT BEDA dari 2 di atas: ini "wajib ada nilainya"
  (tanpa ini sync skip baris), tapi TETAP user yang tentukan nilainya
  (bukan hardcoded kode) — sama seperti `retailku_account_mapping`
  sekarang, cuma pindah tempat penyimpanan

Field lain di luar 4 ini (mis. `contact_id`) BELUM dibahas — di luar
cakupan versi pertama ini, bisa ditambah kalau ada kebutuhan konkret.

## Bentuk key — per mode, DIVERIFIKASI dengan data nyata (bukan asumsi)

### Mode summary: `mode + arah + retailkuAccountId`

**Kenapa perlu dimensi arah**: dibuktikan dari database dev
`financial-app` (2026-09-01 s/d 23, storeId Warung Aqil) — akun
Seabank (id lokal 44) berganti arah `income`/`expense` di HARI
BERBEDA (expense 3 hari beruntun, lalu income, lalu expense lagi,
dst). Karena mode summary menggabung SEMUA sourceType jadi satu net
per akun per hari, arahnya TIDAK stabil — key TANPA arah akan
membuat 1 key yang sama perlu note/category berbeda tergantung hari,
mustahil di-mapping sekali di awal.

Bentuk: `summary:<inflow|outflow>:<retailkuAccountId>` — contoh:
`summary:outflow:b9179630-4515-4269-83d0-a52d6dc7e2c1` (Seabank net
negatif), `summary:inflow:d254e605-bb33-4dfd-b57b-1224819ba3e4` (Kas
Tunai net positif). Jumlah key maksimal = (jumlah akun termapping) × 2.

`retailkuAccountId` (UUID Retailku), BUKAN `accountName` (bisa
berubah kalau di-rename di Retailku) atau `localAccountId` (perlu
mapping akun sudah ada dulu, menambah dependency urutan) — nama akun
untuk tampilan UI di-lookup terpisah saat render, bukan bagian key.

### Mode detail: `mode + retailkuAccountId + sourceType + arah`

**Awalnya diasumsikan CUKUP `mode+akun+sourceType` TANPA arah**
(karena sample awal: 19 kombinasi akun+sourceType di rentang
Agustus–September semuanya konsisten satu arah) — **ASUMSI INI
TERBUKTI SALAH**, dikoreksi user lewat pertanyaan eksplisit
("akun ada kemungkinan keluar masuk saldonya") dan diverifikasi lewat
MCP nyata:

**Bukti nyata (`SL-260915-05`, dicek `get_sale_detail` +
`get_cashflow_detail`)**: transaksi SALE murni SERVICE+MERCHANDISE+
MANUFACTURE (TIDAK ADA PPOB), customer bayar via Seabank
(`paymentLines[0].account.name: "Seabank"`) — hasil cashflow:
`accountName: "Seabank", sourceType: "SALE", debit: 54000, credit: 0`
(net POSITIF/pendapatan). Ini KONTRADIKSI dengan pola yang terlihat di
39 baris SALE+Seabank lain (lihat query lengkap di bawah) yang SEMUA
kredit (payout PPOB) — `isProviderPayoutAccount: true` untuk KEDUANYA
(karena flag itu level-akun, bukan level-baris — lihat
`retailku-sale-category-mapping.md`), tapi maknanya BERLAWANAN.

**Query verifikasi lengkap** (`journal_entries`+`journal_items`+
`sale_transaction_items`+`products`, storeId Warung Aqil, akun kode
1102 Seabank, `sourceType='SALE'`, seluruh riwayat): 39 baris — SEMUA
baris KREDIT (payout) punya `product_types` mengandung `PPOB`; SEMUA
baris DEBIT (pendapatan) punya `product_types` `MERCHANDISE` saja
(tanpa PPOB) atau kosong. Pola konsisten, TAPI arahnya
BERLAWANAN untuk `sourceType` yang SAMA di akun yang SAMA — CUKUP
BUKTI untuk menyimpulkan akun+sourceType SAJA ambigu tanpa dimensi
arah.

Bentuk: `detail:<retailkuAccountId>:<sourceType>:<inflow|outflow>` —
contoh: `detail:b9179630-...:SALE:outflow` (payout PPOB via Seabank,
BEDA key dari) `detail:b9179630-...:SALE:inflow` (pendapatan yang
kebetulan dibayar via Seabank).

## Field fallback default (kalau user belum atur mapping untuk suatu key)

- `note`: template lama tetap dipakai APA ADANYA sebagai default —
  summary: `` `Ringkasan Kas Harian Retailku — ${accountName}` ``,
  detail: `` `Kas Harian Retailku — ${accountName} — ${sourceType}` ``.
  TIDAK breaking untuk user yang belum sempat atur mapping.
- `category_id`: default `NULL` (behavior sekarang — sync tidak
  pernah mengisi kategori).
- `description`: default `NULL`.
- `local_account_id`: TIDAK ADA default — kalau belum di-mapping,
  baris di-skip dengan `skipReason: "unmapped-account"` (SAMA PERSIS
  behavior `retailku_account_mapping` sekarang, cuma pindah tabel).

## Skema tabel (rancangan awal, migrasi RETIRE `retailku_account_mapping`)

Konsumen `retailku_account_mapping` yang perlu ikut disesuaikan
(ditemukan lewat grep, BELUM diverifikasi lebih lanjut di sesi ini —
kerjakan saat implementasi):
- `sync/cashflow/helpers/load-account-mapping.ts`
- `sync/sync-all.ts`
- `sync/cashflow/types.ts`
- `shared/retailku/mcp-hooks/use-retailku-account-mapping.ts`
- UI mapping di `features/retailku/mapping/` (`account-mapping-list.tsx`,
  `account-mapping-row.tsx`, `use-account-mapping-draft.ts`) — perlu
  redesign untuk field tambahan (note/category/description), BUKAN
  cuma dropdown akun seperti sekarang

Migrasi perlu MEMBAWA data lama (`retailku_account_id` →
`local_account_id` yang sudah ada) ke skema baru, bukan mulai dari
nol — user yang sudah setup mapping akun tidak boleh kehilangan
konfigurasinya. Detail migrasi (bentuk SQL persis, strategi transisi)
BELUM ditulis di sini — dikerjakan di tahap implementasi, ikuti pola
"copy-and-rename" SQLite yang sudah dipakai migrasi lain di proyek ini
kalau perlu mengubah struktur, BUKAN `ALTER TABLE` langsung untuk
constraint yang SQLite tidak dukung.

## Di luar cakupan versi pertama ini

- **Mode ketiga** (breakdown PPOB/Consignment berbasis
  `isProviderPayoutAccount`/`productTypes`/`nonRevenuePortion`, lihat
  `retailku-sale-category-mapping.md`) — key mode ini BELUM dirancang,
  sengaja dikerjakan TERPISAH sambil skema summary/detail di atas
  sudah jalan produksi beberapa hari dulu (keputusan eksplisit user:
  "coba begini dulu selama beberapa hari sambil mengembangkan mode
  ketiga").
- Field lain di luar note/category_id/description/account_id (mis.
  `contact_id`) — belum ada kebutuhan konkret yang dibahas.
- UI konfigurasi mapping baru — perlu didesain ulang dari
  `features/retailku/mapping/` yang sekarang (cuma list akun), belum
  dirinci di dokumen ini.

# Sync AR/AP lewat `get_cashflow_detail` (menggantikan `get_ar_ap` + snapshot-diff)

> **Status (2026-09-24): DIIMPLEMENTASIKAN di kedua repo, TERVERIFIKASI
> jalan di database dev nyata (transaksi + `debts`/`debt_payments`
> tercatat benar, termasuk FIFO otomatis) — TAPI USER BELUM MENYATAKAN
> "OKE" untuk fitur AR/AP-nya sendiri, masih akan didiskusikan ulang
> lebih lanjut (bukan soal bug teknis, tapi soal apakah PERILAKUNYA
> sudah sesuai kebutuhan — lihat "Belum oke, perlu didiskusikan lagi"
> di bagian akhir). JANGAN anggap fitur ini "selesai" sampai ada
> konfirmasi eksplisit itu.**
>
> Sisi Retailku (`retail-multitenant`): SELESAI, TIDAK ada migrasi
> skema — cukup query tambahan ke `AccountMapping` yang sudah ada.
> Sisi financial-app: SELESAI, TERMASUK migrasi baru 0021 (drop
> `retailku_ar_ap_snapshot`) DAN 0022 (bug TERPISAH yang ditemukan saat
> testing, lihat "Bug ditemukan saat implementasi" di bawah).

## Latar belakang

Sync AR/AP sekarang (`sync-ar-ap.ts` + `retailku_ar_ap_snapshot`,
lihat `retailku-cashflow-sync.md` bagian "Sync AR/AP") memanggil MCP
tool **terpisah** (`get_ar_ap`) dari cashflow (`get_cashflow_detail`) —
dua koneksi MCP, dua alur idempotency yang berbeda bentuk:

- Cashflow: idempotency PER TRANSAKSI (`source_ref` = tanggal+akun[+sourceType+arah],
  dicek `isPeriodSynced` sebelum insert).
- AR/AP: idempotency PER SNAPSHOT-DELTA — `get_ar_ap` cuma
  mengembalikan TOTAL outstanding per pihak saat ini (bukan daftar
  transaksi), jadi `sync-ar-ap.ts` menyimpan snapshot terakhir
  (`retailku_ar_ap_snapshot`) dan menghitung SELISIH (`delta`) dari
  snapshot sebelumnya sebagai "piutang/utang baru".

**Bug ditemukan (2026-09-24), diverifikasi lewat data prod nyata**:
`retailku_ar_ap_snapshot` di database prod (`finance.db`) terisi 4
pihak dengan `updated_at` seragam, TAPI **tidak ada satu pun baris
`transactions`/`debts`** untuk kontak generik "Piutang Retailku"/"Utang
Retailku" — snapshot sempat maju tapi transaksinya tidak pernah
permanen tersimpan (kemungkinan kena rollback manual dari error di
jalur lain saat `syncAll`, snapshot AR/AP tidak ikut ter-rollback
kalau error terjadi SEBELUM `syncArAp` sempat jalan sama sekali di
percobaan berikutnya — analisis akar penyebab persis belum
dituntaskan, lihat "Di luar cakupan"). Dibandingkan: di `finance.dev.db`,
sync AR/AP TERBUKTI bisa jalan sempurna (5+ baris `debts` tercatat
benar) — jadi bug ini soal STATE/RACE, bukan logika `sync-ar-ap.ts`
yang salah.

**Godaan untuk sekadar memperbaiki bug rollback itu ditahan** — akar
masalah lebih dalam: py dua sumber data independen (snapshot-diff vs
transaksi individual) yang harus dijaga konsisten SECARA MANUAL adalah
desain yang inheren rapuh. Query eksplorasi ke database dev Retailku
(`multi-retail-db`, tabel `journal_entries`/`journal_items`/`accounts`)
menemukan bahwa Retailku **sebenarnya SUDAH mencatat piutang/utang
sebagai jurnal per-transaksi individual** (bukan cuma total berjalan),
lihat "Temuan kunci" — jadi snapshot-diff itu tidak perlu ada sama
sekali kalau `get_cashflow_detail` mau menyertakan baris-baris itu.

## Temuan kunci (diverifikasi langsung ke `multi-retail-db` via `docker exec`)

- Setiap piutang baru dari SALE menghasilkan baris jurnal DEBIT ke
  akun "Piutang Dagang" (kode `1500`) BERSAMAAN dengan baris SALE yang
  sama (dibuktikan: `journal_entries` utk `SL-260912-09`, item ke akun
  `1500` `debit: 2000`, `note: "Piutang dagang SL-260912-09"`).
- Pelunasannya (`SALE_PAYMENT`, `sourceNumber SP-260922-01`) adalah
  ENTRI JURNAL TERPISAH yang meng-KREDIT akun `1500` yang SAMA,
  `sourceSnapshot.paymentType: "SETTLEMENT"` — py identitas transaksi
  sendiri (`sourceType`/`sourceNumber`/tanggal), BUKAN cuma angka
  agregat.
- Chart akun piutang/utang KONSISTEN lintas semua toko (bagian dari
  seed default, dibuktikan lewat `SELECT DISTINCT code, name FROM
  accounts` — py `parentId` beda per toko tapi `code`/`name` sama):
  | code | name | category | normalBalance |
  |------|------|----------|---------------|
  | 1500 | Piutang Dagang | ASSET | DEBIT |
  | 1700 | Piutang Supplier | ASSET | DEBIT |
  | 1800 | Piutang Lain-lain | ASSET | DEBIT |
  | 2100 | Hutang Dagang | LIABILITY | CREDIT |
  | 2200 | Utang Lain-lain | LIABILITY | CREDIT |
  | 2300 | Hutang ke Penitip | LIABILITY | CREDIT |
- **KENAPA baris ini tidak muncul di `get_cashflow_detail` sekarang**:
  query di `get-cfr-detail.helper.ts` (baris 21) filter
  `account: { isTrackedAsset: true }` — SEMUA 6 akun di atas
  `isTrackedAsset: false` (dikonfirmasi query langsung), BEDA dari
  akun kas/bank (`1101`/`1102`, dst) yang `isTrackedAsset: true`. Jadi
  bukan API-nya salah, cuma SENGAJA dibatasi ke akun likuid saja waktu
  awal dibangun (sebelum kebutuhan AR/AP granular ini muncul).
- **KOREKSI PENTING (setelah eksplorasi lebih lanjut)**: dugaan awal
  "tidak ada flag eksplisit, cuma bisa deteksi dari kode akun" TERBUKTI
  SALAH. `system_account_pointers` (`SystemPointerRole`) memang cuma
  untuk akun PARENT kategori umum (investment/transit/equity/dst), TAPI
  ada model TERPISAH yang PERSIS menjawab kebutuhan ini:
  `AccountMapping` (`account_mappings` table) dengan enum
  `AccountMappingRole` yang SUDAH PUNYA 6 nilai relevan —
  `TRADE_RECEIVABLE`, `SUPPLIER_RECEIVABLE`, `OTHER_RECEIVABLE`,
  `ACCOUNTS_PAYABLE`, `OTHER_PAYABLE`, `CONSIGNMENT_PAYABLE` — masing-
  masing dipetakan `(storeId, role) -> accountId` (constraint
  `@@unique([storeId, role])`, lihat `finance-account.prisma`).
  Diverifikasi ke `account_mappings` nyata: SEMUA 37 toko aktif
  (`deletedAt IS NULL`) punya KELIMA role wajib
  (`TRADE_RECEIVABLE`/`SUPPLIER_RECEIVABLE`/`OTHER_RECEIVABLE`/
  `ACCOUNTS_PAYABLE`/`OTHER_PAYABLE`) terisi lengkap, menunjuk PERSIS
  ke akun kode 1500/1700/1800/2100/2200 yang sama seperti tabel di
  atas (`CONSIGNMENT_PAYABLE`→2300 cuma 7 toko, wajar karena tidak
  semua toko punya consignment aktif). **Ini berarti TIDAK PERLU
  migrasi skema/kolom baru di `Account` sama sekali** — cukup query
  `account_mappings` yang sudah ada untuk tahu akun mana saja yang
  berperan piutang/utang per toko, rancangan di bawah diupdate
  mengikuti temuan ini (bukan lagi field boolean baru).

## Rancangan sisi Retailku (`retail-multitenant`)

**TIDAK PERLU migrasi skema maupun skrip backfill data sama sekali** —
mekanisme deteksi akun piutang/utang SUDAH ADA (`AccountMapping`/
`AccountMappingRole`, lihat "Temuan kunci" di atas). Seluruh rancangan
ini murni PERUBAHAN QUERY (read-only tambahan), bukan perubahan
struktur data.

### 1. Query tambahan: ambil `accountId` piutang/utang toko ini dari `account_mappings`

Di `get-cfr-detail.helper.ts`, tambah SATU query paralel (masuk
`Promise.all` yang sudah ada bersama `journalEntry.findMany`/
`provider.findMany`):

```ts
const RECEIVABLE_PAYABLE_ROLES: AccountMappingRole[] = [
  'TRADE_RECEIVABLE',
  'SUPPLIER_RECEIVABLE',
  'OTHER_RECEIVABLE',
  'ACCOUNTS_PAYABLE',
  'OTHER_PAYABLE',
  'CONSIGNMENT_PAYABLE',
];

const receivablePayableMappings = await prisma.accountMapping.findMany({
  where: { storeId, role: { in: RECEIVABLE_PAYABLE_ROLES } },
  select: { role: true, accountId: true },
});
const receivablePayableAccountIds = new Set(receivablePayableMappings.map((m) => m.accountId));
const roleByAccountId = new Map(receivablePayableMappings.map((m) => [m.accountId, m.role]));
```

### 2. Perluas filter query utama

```ts
// SEBELUM (baris 21):
items: { some: { deletedAt: null, account: { isTrackedAsset: true } } },

// SESUDAH:
items: {
  some: {
    deletedAt: null,
    account: {
      OR: [
        { isTrackedAsset: true },
        { id: { in: [...receivablePayableAccountIds] } },
      ],
    },
  },
},
```

Filter `select`/`where` di `items:` nested query (baris 30) ikut
diubah sama — TAPI query kedua (ambil `receivablePayableAccountIds`)
HARUS jalan LEBIH DULU (`await` terpisah sebelum `Promise.all` utama,
bukan digabung ke dalamnya) karena hasilnya dipakai SEBAGAI bagian
filter `journalEntry.findMany`, beda dari `providers` yang dipakai
SETELAH data jurnal didapat (lihat kode existing baris 70).

### 3. Field baru di response `get_cashflow_detail`

Menambah 2 field per baris (pola sama `isProviderPayoutAccount`):

```ts
isReceivablePayableAccount: boolean; // true = baris ini piutang/utang, bukan kas/bank
receivablePayableDirection: "receivable" | "payable" | null; // null kalau isReceivablePayableAccount false
```

```ts
isReceivablePayableAccount: receivablePayableAccountIds.has(item.account.id),
receivablePayableDirection: (() => {
  const role = roleByAccountId.get(item.account.id);
  if (!role) return null;
  return role.includes('PAYABLE') ? 'payable' : 'receivable';
})(),
```

`item.account.category`/`normalBalance` BISA dipakai sebagai
alternatif derivasi arah (`ASSET`→receivable, `LIABILITY`→payable) —
TAPI turunan dari `role` LEBIH TEPAT dipakai di sini karena filter
`receivablePayableAccountIds` sendiri sudah berbasis role, konsisten
satu sumber kebenaran (bukan campur dua cara deteksi berbeda untuk
hal yang sama).

**Opsional, pertimbangkan sekalian**: ekspos juga `role`-nya mentah
(`"TRADE_RECEIVABLE"` dst, bukan cuma `receivable`/`payable`) kalau
financial-app nanti mau membedakan JENIS piutang/utang (dagang vs
supplier vs lain-lain vs consignment) di UI mapping — BELUM ada
kebutuhan konkret untuk ini di rancangan financial-app di bawah
(baru butuh `receivable`/`payable` generik), jadi TIDAK wajib
sekarang, cukup dicatat sebagai opsi murah untuk ditambah kalau
diperlukan nanti (query sumbernya sama, tinggal include field `role`
di response).

### 4. `id` per baris SUDAH ADA (`item.id`, journal item UUID) — pakai ini sebagai identitas idempotency

`get-cfr-detail.helper.ts` baris 113 SUDAH mengembalikan `id:
item.id` (journal item individual) — konsumen (financial-app) BISA
langsung pakai ini sebagai bagian `source_ref` per baris AR/AP
(idempotency PER TRANSAKSI, bukan snapshot-delta), TIDAK perlu field
tambahan lagi untuk ini.

### Konsekuensi (harus diverifikasi saat implementasi, BUKAN diasumsikan)

- Performa: 1 query tambahan (`accountMapping.findMany`, ringan —
  `WHERE storeId + role IN (...)`, sudah ada unique index
  `(storeId, role)`) + akun tambahan ikut di filter utama — DAMPAK
  performa BELUM diukur nyata (beda dari 3 field
  `isProviderPayoutAccount`/dst yang sudah diukur ~11-15ms, lihat
  `retailku-sale-category-mapping.md`). WAJIB `EXPLAIN ANALYZE` ulang
  sebelum menganggap aman untuk toko dengan riwayat piutang panjang.
- Baris pelunasan (`SALE_PAYMENT` dg `paymentType: "SETTLEMENT"`) ikut
  masuk SEBAGAI 2 baris jurnal terpisah (kas + piutang berlawanan
  arah) — konsumen HARUS baca `isReceivablePayableAccount` per baris,
  BUKAN asumsi 1 `sourceNumber` = 1 baris cashflow (sudah demikian
  untuk `isProviderPayoutAccount`, pola sama).
- `nonRevenuePortion`/`productTypes` TIDAK relevan untuk baris
  piutang/utang (field itu spesifik SALE dg item PPOB/CONSIGNMENT) —
  tetap `null` untuk baris ini, TIDAK perlu logic tambahan (kondisi
  `saleTransaction` di query yang sudah ada otomatis `null` kalau
  entry bukan SALE dg item PPOB/CONSIGNMENT).
- Toko yang (secara teori) BELUM punya salah satu role wajib ter-map
  — DIVERIFIKASI TIDAK ADA di antara 37 toko aktif saat ini, TAPI
  kode harus tetap aman kalau suatu saat ada toko baru yang belum
  sempat setup lengkap (`receivablePayableAccountIds` kosong/parsial
  untuk toko itu bukan error, cuma berarti baris piutang/utang toko
  itu tidak ikut muncul sampai mapping-nya dilengkapi — SAMA seperti
  perilaku sekarang, degradasi aman bukan crash).

## Rancangan sisi financial-app

### 1. `computeCashflowSync` mendeteksi baris AR/AP dari flag baru

`fetchAllCashflowDetailRows`/`RetailkuCashflowDetailRow` (types)
menambah 2 field baru (`isReceivablePayableAccount`,
`receivablePayableDirection`) mengikuti response MCP. Baris dengan
`isReceivablePayableAccount: true` DIPISAH dari alur agregasi
cashflow biasa (`aggregate-by-date-and-account.ts`/
`aggregate-by-date-account-and-source-type.ts` TIDAK menyentuhnya)
— diproses jalur baru yang PARALEL, bukan digabung ke `net` akun kas
(supaya tidak salah "menganggap" piutang baru sebagai pemasukan kas).

### 2. Key mapping baru untuk AR/AP: `ar_ap:<receivable|payable>`

HANYA 2 key mungkin total (bukan per akun/pihak — beda dari
key cashflow biasa) — user cukup atur SEKALI "piutang baru masuk akun
debt lokal mana" dan "utang baru masuk akun debt lokal mana", SAMA
persis dengan field "Akun untuk Piutang"/"Akun untuk Utang" yang
SUDAH ADA di tab Konfigurasi (`debt-accounts-section.tsx`) — TIDAK
perlu UI baru, field existing itu JADI mapping-nya (bukan field
terpisah lagi). Field "Akun Kas untuk Utang Piutang"
(`ar-ap-cash-account-section.tsx`) JUGA tetap dipakai sebagai sisi kas
transaksi transfer.

### 3. Insert transaksi PER BARIS (bukan lagi per snapshot-delta)

Untuk tiap baris `isReceivablePayableAccount: true`:
- `receivablePayableDirection === "receivable"`: transfer kas→debt
  (piutang baru) ATAU debt→kas (pelunasan, TERGANTUNG arah
  debit/credit baris itu — debit ke akun piutang = piutang baru,
  kredit = pelunasan, ikuti `normalBalance` `DEBIT` utk kategori
  `ASSET`).
- `receivablePayableDirection === "payable"`: sebaliknya (kredit =
  utang baru, debit = pelunasan, ikuti `normalBalance` `CREDIT`).

Pelunasan HARUS ditangani berbeda dari piutang/utang baru
(`applyDebtTransaction` sudah punya cabang `debtAction: "settlement"`
dg `settleDebtIds` FIFO — TAPI itu untuk transfer manual dari FORM
user yang PILIH sendiri debt mana yang dilunasi; sync OTOMATIS tidak
punya cara user memilih, jadi BUTUH strategi FIFO otomatis: lunasi
`debts` TERLAMA untuk kontak generik "Piutang Retailku"/"Utang
Retailku" dulu — **DIIMPLEMENTASIKAN, lihat "Implementasi sisi
financial-app" di bawah untuk hasil & verifikasinya**).

`source_ref` per baris: `` `${journalItemId}:ar_ap` `` (journal item
`id` dari Retailku, UNIK per baris SELAMANYA — tidak seperti
`source_ref` snapshot lama yang berbasis tanggal+partyId+arah dan bisa
tabrakan kalau sync di-retry hari yang sama, PERSIS bug idempotency
AR/AP yang sudah dicatat "ditunda" di handover 2026-09-23). Idempotency
check pakai pola SAMA `isPeriodSynced` (cukup `SELECT 1 WHERE
source_ref = $1`, journal item id sudah unik jadi tidak perlu prefix
LIKE seperti cashflow biasa).

### 4. `retailku_ar_ap_snapshot` DIPENSIUNKAN

Migrasi baru: `DROP TABLE retailku_ar_ap_snapshot` — TIDAK ADA data
untuk dibawa (snapshot cuma housekeeping internal, bukan data
finansial user; baris `debts`/`transactions` yang SUDAH ter-insert di
dev.db dari alur lama TETAP VALID, tidak perlu dihapus/migrasi ulang,
cuma sync BERIKUTNYA yang pakai jalur baru). `sync-ar-ap.ts` DIHAPUS
sepenuhnya, digantikan logic di dalam `compute-cashflow-sync.ts`/
`sync-cashflow.ts` (poin 1-3 di atas) — `syncAll.ts` jadi lebih
sederhana (SATU alur sync, bukan dua `syncCashflow`+`syncArAp`
berurutan dg rollback lintas keduanya).

**Dampak ke `rollbackManually`/`syncAll.ts`**: rollback jadi LEBIH
SEDERHANA — cukup 1 `insertedSourceRefs` gabungan dari 1 alur sync,
TIDAK perlu lagi `rollbackArApSnapshots`/`previousSnapshotsById`
(seluruh kelas bug rollback-snapshot-AR/AP yang jadi motivasi
dokumen ini OTOMATIS TIDAK ADA LAGI, bukan diperbaiki tapi
DIHILANGKAN strukturnya).

## Data prod yang sudah terlanjur bermasalah — perlu keputusan terpisah

Snapshot `retailku_ar_ap_snapshot` di prod SAAT INI menunjukkan 4
pihak (Ayah 15000 receivable, Mba-mba Kado Kuning 4500 payable, Nde
Wayu Wadon 5000 receivable, Nenek Marun 3000 receivable) TANPA
transaksi `debts` yang sesuai — kalau arsitektur baru ini
diimplementasikan, baris piutang/utang ini AKAN muncul lagi lewat
`get_cashflow_detail` yang diperluas (karena itu jurnal ASLI yang
memang ada di Retailku, bukan snapshot lokal) dan otomatis tercatat
BENAR di sync pertama pakai jalur baru — snapshot lama yang salah
TIDAK menghalangi ini (tabelnya di-drop, tidak dibaca lagi). TIDAK
perlu migrasi/pembersihan data manual tambahan untuk prod.

## Implementasi sisi Retailku — SELESAI (2026-09-24)

`get-cfr-detail.helper.ts` diubah PERSIS sesuai rancangan poin 1-4 di
atas: query `accountMapping.findMany` (6 role), filter `OR
isTrackedAsset/id-in-set` diperluas ke `journalEntry.findMany` DAN
`items:` nested query, 2 field baru (`isReceivablePayableAccount`,
`receivablePayableDirection`, diturunkan dari `role.includes('PAYABLE')`).
**TERVERIFIKASI lewat panggilan MCP nyata** (`get_cashflow_detail`
tanggal 2026-09-22) setelah restart server: total baris naik 31→33,
2 baris baru MUNCUL PERSIS sesuai ekspektasi — pelunasan piutang
`SP-260922-01` (akun 1500 Piutang Dagang, credit 2000, direction
receivable) dan hutang penitip dari consignment `SL-260922-15` (akun
2300 Hutang ke Penitip, credit 1500, **NILAINYA SAMA PERSIS** dengan
`nonRevenuePortion: 1500` di baris SALE-nya — cross-check independen
yang kuat). `tsc`/`eslint` bersih.

## Implementasi sisi financial-app — SELESAI (2026-09-24)

Semua poin 1-4 rancangan financial-app di atas diimplementasikan
PERSIS: `extract-ar-ap-rows.ts` (baru), `is-ar-ap-row-synced.ts` (baru),
`insert-ar-ap-transaction.ts` (baru, 4 kombinasi arah — lihat catatan
penting di bawah), `types.ts`/`compute-cashflow-sync.ts`/
`sync-cashflow.ts`/`sync-all.ts` diperluas, `sync-ar-ap.ts` DIHAPUS,
migrasi `0021_drop_retailku_ar_ap_snapshot.sql`. `tsc`/`vitest`
(102/102)/`next build` bersih.

**Koreksi penting yang ditemukan SAAT menulis `insert-ar-ap-transaction.ts`**
(bukan diasumsikan dari rancangan awal): tebakan pertama "pelunasan
utang arahnya cash->debt" (berlawanan dari pelunasan piutang) TERBUKTI
SALAH setelah membaca ulang `use-pay-debt.ts` yang SUDAH ADA —
**pelunasan piutang MAUPUN utang SAMA-SAMA arah `debt->cash`**,
dibedakan lewat `debtAction: "settlement"` + `settleDebtIds` yang
SUDAH difilter `type` (`receivable`/`payable`) oleh
`loadOngoingDebtIds`. `applyDebtTransaction` (shared,
`apply-debt-transaction.ts`) TERNYATA SUDAH LENGKAP menangani ke-4
kombinasi tanpa perlu cabang baru sama sekali — keputusan awal "tambah
cabang baru di `applyDebtTransaction`" (dari AskUserQuestion sebelum
menulis kode) DIBATALKAN begitu kesalahan asumsi arah ini ketahuan.

**Strategi FIFO pelunasan otomatis**: diimplementasikan sesuai
keputusan user (bukan lagi "di luar cakupan") — `loadOngoingDebtIds`
ambil SEMUA `debts` `ongoing` milik kontak generik terkait, urut
`date ASC, id ASC`, lempar semua sebagai `settleDebtIds` ke
`applyDebtTransaction` yang MENGALOKASIKAN FIFO sendiri
(`settleDebtsFifo`, TIDAK diubah). **TERVERIFIKASI lewat sync nyata di
`finance.dev.db`**: pelunasan piutang Rp 2.000 teralokasi ke
`debts.id 11` (termasuk tertua, amount 15000, tanggal 2026-09-21),
status TETAP `ongoing` (bukan `paid`) karena alokasi cuma partial —
PERSIS perilaku yang diharapkan `settleDebtsFifo`.

## Bug ditemukan saat implementasi — TERPISAH dari fitur AR/AP, SUDAH DIPERBAIKI

**Bug laten migrasi 0019** (`transaction_note_not_null`, JAUH SEBELUM
sesi AR/AP ini) — bukan disebabkan perubahan sesi ini, cuma baru
KETAHUAN sekarang karena `insertArApTransaction` adalah kode PERTAMA
yang insert ke `debts` dalam alur otomatis sejak migrasi itu berjalan.
Migrasi 0019 `ALTER TABLE transactions RENAME TO transactions_old`
lalu rebuild `transactions`, TAPI TIDAK ikut merebuild 3 tabel yang
FK `transaction_id`-nya menunjuk ke situ (`transaction_attachments`,
`debts`, `debt_payments`) — SQLite tidak mengikuti rename pada FK
tabel LAIN (FK simpan nama string literal), jadi ketiganya diam-diam
menunjuk ke `transactions_old` yang sudah di-drop. Ini melanggar pola
yang SUDAH didokumentasikan sendiri di migrasi 0009 ("PENTING #2":
rename SEMUA tabel terlibat dulu sebelum drop apa pun).

**Gejala nyata**: toast merah "error returned from database: (code: 1)
no such table: main.transactions_old" saat tombol "Sync Sekarang"
ditekan — transaksi `transactions` SEMPAT ter-insert (commit), tapi
`applyDebtTransaction` (insert `debts`) gagal PERSIS di tengah,
menyisakan 2 baris `transactions` "yatim" (id 5565/5566 di dev.db,
tanpa `debts`/`debt_payments` pasangannya). **Efek samping penting**:
`isArApRowSynced` cuma cek `transactions.source_ref`, jadi sync
berikutnya MENGANGGAP baris yatim itu "sudah tersinkron" dan TIDAK
retry — bug idempotency baru yang harus disadari kalau kasus serupa
terulang (jejak parsial tidak self-healing lewat retry biasa).

**Perbaikan**: migrasi baru `0022_fix_transactions_old_fk.sql` —
rebuild `transaction_attachments`/`debts`/`debt_payments` dengan FK
benar ke `transactions`, ikuti pola rename-semua-dulu dari 0009.
**TERVERIFIKASI 2x**: (1) migrasi diuji dulu terhadap SALINAN
database dev sebelum disarankan ke user (skema bersih, row count
utuh 13 debts/8 debt_payments, `PRAGMA foreign_key_check` bersih,
simulasi insert yang tadinya gagal berhasil); (2) setelah migrasi
diterapkan user via restart app, 2 baris `transactions` yatim (5565,
5566) DIHAPUS manual dari `finance.dev.db` (dikonfirmasi dulu tidak
ada `debts`/`debt_payments` terkait, app ditutup dulu untuk hindari
race WAL), lalu user sync ulang — kali ini `debts`/`debt_payments`
tercatat benar (lihat "Implementasi sisi financial-app" di atas).

## Belum oke, perlu didiskusikan lagi

User EKSPLISIT menyatakan fitur AR/AP ini **"masih belum bisa dikatakan
oke"** (2026-09-24, akhir sesi) — TANPA merinci alasan spesifik di
percakapan ini. JANGAN diasumsikan sebagai bug teknis yang sudah
ditemukan (semua yang ditemukan sejauh ini SUDAH diperbaiki &
diverifikasi, lihat bagian di atas) — kemungkinan besar ini soal
PERILAKU/DESAIN yang perlu dibahas ulang, bukan lagi soal "apakah
kodenya jalan". Kandidat topik yang BELUM dibahas tuntas dan mungkin
jadi sumber keraguan (dugaan, BUKAN konfirmasi — tanyakan ke user di
sesi lanjutan, JANGAN diasumsikan benar):
- Trade-off FIFO otomatis vs urutan pelunasan RIIL per pihak di
  Retailku (didokumentasikan sejak awal sebagai risiko yang disadari,
  tapi mungkin user ingin lihat dulu dampaknya di skenario nyata
  sebelum menerima trade-off ini).
- Kontak digabung GENERIK ("Piutang Retailku"/"Utang Retailku")
  bukan per pihak individual — keputusan LAMA (sebelum sesi ini),
  tapi mungkin sekarang dipertanyakan ulang mengingat granularitas
  baru yang sudah dicapai di sisi lain (tiap baris jurnal individual
  Retailku sekarang KETAHUAN, jadi secara teknis per-pihak individual
  jadi lebih mungkin daripada sebelumnya).
- Apakah "Akun untuk Piutang"/"Akun untuk Utang" yang SAMA-SAMA
  "Bisnis" (id 70, dikonfirmasi dari data dev) itu konfigurasi yang
  diinginkan, atau sekadar nilai sementara saat testing.

## Di luar cakupan rancangan ini (masih terbuka)

- **Pengukuran performa nyata** query `get_cashflow_detail` yang
  diperluas — WAJIB `EXPLAIN ANALYZE` dengan data toko yang punya
  riwayat piutang/utang panjang sebelum dianggap aman diproduksi,
  ikuti standar yang sudah dipakai `retailku-sale-category-mapping.md`
  (bukan asumsi "pasti cepat" tanpa angka) — BELUM dilakukan.
- **Opsi ekspos `role` mentah** (`TRADE_RECEIVABLE` dst, bukan cuma
  `receivable`/`payable`) di response `get_cashflow_detail` — dicatat
  sebagai opsi murah di rancangan sisi Retailku, TIDAK diimplementasikan
  (belum ada kebutuhan konkret).

# Handover — 2026-09-23 (sesi 3)

Lanjutan dari `2026-09-23-2-account-detail-content-dan-retailku-sale-category-eksplorasi.md`.
Sesi ini: (1) menuntaskan eksplorasi mapping kategori PPOB/Consignment
jadi implementasi konkret di sisi server Retailku, (2) merancang &
mengimplementasikan arsitektur mapping field non-fakta yang
menggantikan `retailku_account_mapping`, (3) mulai UI tab Mapping baru
(sudah ter-commit di luar observasi langsung sesi percakapan ini —
lihat catatan di bagian akhir).

## 1. Implementasi field baru di `get_cashflow_detail` (sisi `retail-multitenant`) — SELESAI

Lanjutan `docs/todos/plan/retailku-sale-category-mapping.md` (status
sebelumnya: EKSPLORASI). Tiga field baru ditambahkan ke response tool
MCP `get_cashflow_detail`, SEMUANYA **tanpa panggilan MCP tambahan**
dari sisi konsumen — cuma memperluas `select` Prisma yang sudah ada di
`get-cfr-detail.helper.ts`:

1. **`isProviderPayoutAccount: boolean`** — `true` kalau akun itu
   terdaftar sebagai `Provider.accountId` (skema Retailku, tabel
   `providers`) — sumber kebenaran akun payout PPOB, TIDAK PERNAH perlu
   heuristik nominal/nama akun seperti dugaan awal. **Batasan penting**:
   level AKUN bukan level BARIS — akun yang sama bisa juga dipakai untuk
   `PURCHASE_ORDER`/`INVESTMENT_TRANSACTION`, jadi flag ini SAJA tidak
   cukup, harus dibaca bersama `sourceType`.
2. **`productTypes: string[] | null`** — semua `ProductType` (enum
   penuh Retailku: MERCHANDISE/MANUFACTURE/DIGITAL/PPOB/SERVICE/
   CONSIGNMENT) yang terlibat di transaksi SALE sumber, via join
   `JournalEntry → SaleTransaction → SaleTransactionItem → Product`.
   `null` kalau `sourceType` bukan SALE.
3. **`nonRevenuePortion: number | null`** — jumlah Rupiah dari nilai
   transaksi SALE yang BUKAN pendapatan murni toko (payout provider
   PPOB + hutang penitip consignment DIGABUNG). **Temuan kunci**:
   direkonstruksi dari `totalCost` yang SUDAH tersimpan permanen di
   `SaleTransactionItem` (`unitCost = unitPrice - commissionAmountPerBase`
   untuk consignment) — TIDAK PERLU tabel `ConsignmentReceivingItem`/
   `ConsignmentStockLog` terpisah. Diverifikasi akurat 100% lewat
   `EXPLAIN ANALYZE` + data nyata (`SL-260904-14`: `totalCost` tersimpan
   = nilai baris jurnal "Hutang ke Penitip" PERSIS SAMA).

**Dampak performa DIUKUR NYATA** (bukan estimasi) sebelum implementasi:
query + join produk cuma **~11-15ms** untuk 9 bulan riwayat penuh toko
sample (~1.723 transaksi SALE), semua pakai index scan. Detail lengkap
+ tabel sample data mentah ada di `retailku-sale-category-mapping.md`.

**Semua 3 field diverifikasi lewat panggilan `get_cashflow_detail`
nyata** (setelah restart server, MCP "Warung Aqil") — angka cocok
persis dengan perhitungan manual dari jurnal. Termasuk kasus edge
PENTING yang ditemukan lewat pertanyaan user, bukan diasumsikan:
**`isProviderPayoutAccount: true` BISA salah kalau dibaca sendirian** —
`SL-260915-05` adalah SALE murni (SERVICE+MERCHANDISE+MANUFACTURE,
TANPA PPOB) yang kebetulan dibayar via akun Seabank (yang JUGA akun
provider) — hasilnya `debit: 54000` (pendapatan asli), BUKAN payout,
meski `isProviderPayoutAccount: true`. `nonRevenuePortion: null` di
baris ini yang jadi pembeda benar.

## 2. Arsitektur mapping field non-fakta — DIRANCANG & sebagian DIIMPLEMENTASIKAN

Dipicu pertanyaan user: field sync yang sekarang selalu kosong/hardcoded
(`category_id` selalu NULL, `note` selalu template hardcoded di kode)
mau bisa dikustomisasi user per jenis transaksi, SEKALI diatur di awal
(bukan edit manual per transaksi). Dokumen baru:
**`docs/todos/plan/retailku-sync-field-mapping.md`**.

### Insight inti (ditemukan lewat diskusi + VERIFIKASI DATA, bukan asumsi)

`retailku_account_mapping` lama (akun Retailku → akun lokal) ternyata
KASUS KHUSUS dari kebutuhan yang lebih umum: tiap mode sync punya
"pertanyaan" beda kompleksitas — summary = "masuk akun mana", detail =
"sourceType apa, masuk akun mana". Solusi: SATU tabel baru
(`retailku_sync_field_mapping`) yang MENGGANTIKAN yang lama, keyed by
**`key`** (identitas "jenis" baris, TANPA tanggal/nominal) — bukan
`retailkuAccountId` mentah.

**Bentuk key, DIKOREKSI 2x lewat verifikasi data nyata** (jangan percaya
versi awal di kepala, ikuti yang FINAL):
- **Summary**: `` `summary:${arah}:${retailkuAccountId}` `` — arah
  (`inflow`/`outflow`) WAJIB karena SATU akun TERBUKTI bisa berganti
  arah hari ke hari (dibuktikan lewat data dev: akun Seabank income lalu
  expense di hari berbeda).
- **Detail**: `` `detail:${retailkuAccountId}:${sourceType}:${arah}` ``
  — awalnya diasumsikan CUKUP tanpa arah (19 kombinasi akun+sourceType
  sample awal semua 1 arah), TAPI user mengoreksi ("akun ada
  kemungkinan keluar masuk saldonya") dan **terbukti benar** lewat
  `SL-260915-05` (SALE+Seabank bisa debit ATAU kredit tergantung isi
  transaksi, sourceType sama persis).

**Field FAKTA** (tidak pernah di-mapping): `amount`, `date`, `type`
(derivable dari arah), `source`, `source_ref`.
**Field NON-FAKTA** (dikustomisasi via mapping, fallback per-KOLOM
independen kalau NULL): `note`, `category_id`, `description`.
`local_account_id` tetap WAJIB (tanpa itu baris di-skip
`unmapped-account`), cuma pindah tabel penyimpanan.

### Implementasi backend — SELESAI, terverifikasi di database nyata

- **Migrasi `0020_retailku_sync_field_mapping.sql`** (+ didaftarkan di
  `migrations.rs` versi 20) — tabel baru, MIGRASI DATA LAMA (tiap baris
  `retailku_account_mapping` lama dibawa jadi 2 baris key baru,
  `summary:inflow:*` + `summary:outflow:*`, `local_account_id` sama),
  lalu `DROP TABLE retailku_account_mapping`.
- **Fungsi agregasi** (`aggregate-by-date-and-account.ts`,
  `aggregate-by-date-account-and-source-type.ts`) generate `key` SETELAH
  net final dihitung (arah baru bisa ditentukan di titik itu, bukan per
  baris mentah).
- **`load-field-mapping.ts`** (baru, menggantikan `load-account-mapping.ts`
  yang dihapus) — lookup `Map<key, RetailkuSyncFieldMappingRow>`.
- **`compute-cashflow-sync.ts`** — lookup by `total.key` (bukan lagi
  `retailkuAccountId`), resolve `note` (fallback ke template default per
  KOLOM), `categoryId`, `description`.
- **`insert-cashflow-transaction.ts`** — terima & simpan `categoryId`/
  `description` ke kolom `transactions` yang sudah ada.
- **Semua konsumen lama diupdate**: `unmappedAccountIds` → `unmappedKeys`
  di seluruh chain (`types.ts`, `sync-cashflow.ts`, `sync-all.ts`,
  `use-sync-now.ts`, `use-retailku-auto-sync.ts`, `preview-sync-section.tsx`,
  test file).
- **`useRetailkuAccountMapping`** (dipakai GLOBAL oleh badge sidebar +
  deteksi orphan mapping, BUKAN cuma halaman mapping) diupdate baca dari
  tabel baru (filter `key LIKE 'summary:inflow:%'` sebagai representative
  1 baris per akun) — SENGAJA dipertahankan aktif supaya sidebar tidak
  crash, BEDA dari halaman UI penuh yang dinonaktifkan sementara.
- **Halaman `/retailku/mapping` LAMA dinonaktifkan sementara** (pesan
  "sedang dikembangkan ulang") — `AccountMappingList`/
  `use-account-mapping-draft.ts` TIDAK DIHAPUS (jadi referensi pola UI),
  cuma tidak lagi dirender; `useSaveRetailkuAccountMapping` dihapus
  (tabel tujuannya sudah tidak ada).
- **Verifikasi**: `tsc`/`vitest run` (101 test)/`next build` semua
  bersih. Migrasi DIVERIFIKASI JALAN NYATA di `finance.dev.db` (bukan
  cuma asumsi) — `_sqlx_migrations` versi 20 `success:1`, data lama
  ter-migrasi PERSIS (2 akun lama → 4 baris key baru, `local_account_id`
  sama).

### Bug ditemukan SAAT verifikasi — BUKAN dari perubahan sesi ini

Toast "Sinkronisasi Retailku otomatis gagal: UNIQUE constraint failed"
muncul saat restart `tauri dev`. **Root cause DIKONFIRMASI** (bukan
dugaan): auto-sync sebelumnya SUKSES insert transaksi (`id 5561/5562/5563`,
termasuk baris AR/AP), TAPI `setSyncSettings.mutate({lastAutoSyncDate})`
di `use-retailku-auto-sync.ts` gagal ter-commit (kemungkinan app
ditutup tepat di jendela race itu) — `lastAutoSyncDate` di `settings`
tetap tanggal lama. Restart berikutnya, auto-sync coba lagi dari
`syncFrom` lama, AR/AP (`sync-ar-ap.ts`, idempotency berbasis
`source_ref: date:partyId:direction` TANPA re-cek "sudah ada atau
belum" seperti `isPeriodSynced` di cashflow) generate `source_ref` SAMA
PERSIS untuk hari yang sama → UNIQUE constraint.

**Keputusan user: DITUNDA, dibahas terpisah nanti** ("masalah ar/ap pun
nanti akan kita breakdown"). Baris yang sudah ter-insert VALID, tidak
perlu dihapus/rollback.

## 3. UI tab Mapping baru — SUDAH MULAI DIKERJAKAN (ter-commit di luar observasi sesi percakapan)

Percakapan berhenti tepat di titik keputusan: user memilih **tab
ketiga di `/retailku/cashflow`** (sejajar "Ringkasan"/"Konfigurasi" di
`CashflowSyncPanel`), BUKAN halaman terpisah — sebelum implementasi
dimulai dari sisi asisten.

**TEMUAN PENTING saat sesi lanjutan ini dibuka**: `git log` menunjukkan
commit `a9c04fd "Update mapping sync cashflow"` SUDAH ADA berisi
implementasi tab ini — file baru `features/retailku/sync-cashflow/mapping/`:
`field-mapping-tab.tsx`, `field-mapping-row.tsx`, `format-mapping-key.ts`,
`mapping-context.tsx`, `hooks/use-load-mapping-keys.ts`,
`hooks/use-mapping-draft.ts`. **BELUM DIVERIFIKASI ulang di sesi
lanjutan ini** (tsc/test/build BELUM dijalankan setelah commit itu) —
sesi berikutnya WAJIB cek dulu status sebenarnya sebelum lanjut,
JANGAN asumsikan otomatis benar cuma karena sudah ter-commit. Cek juga
apakah `mapping-status-section.tsx`/`cashflow-sync-panel.tsx` sudah
disambungkan ke tab baru ini (perlu lihat diff `a9c04fd` untuk field
`retailkuAccountCode` yang ikut ditambahkan ke `AggregatedTotal` — juga
belum diverifikasi alasannya di percakapan ini).

Dari sekilas baca `field-mapping-tab.tsx`: pola yang dibangun adalah
tombol "Muat Jenis Transaksi" (karena `key` baru cuma "ada" setelah
sync/preview menjumpai kombinasi itu — BUKAN baca tabel
`retailku_sync_field_mapping` yang isinya cuma yang SUDAH di-mapping),
lalu tabel editable per baris (akun tujuan, judul, kategori, deskripsi).
Konsisten dengan rancangan di `retailku-sync-field-mapping.md`.

## Lanjut sesi berikutnya

1. **WAJIB LEBIH DULU**: verifikasi ulang state `mapping/` yang sudah
   ter-commit (`a9c04fd`) — jalankan `tsc --noEmit`, `vitest run`,
   `next build`, baca isi lengkap `use-mapping-draft.ts`/
   `use-load-mapping-keys.ts`/`format-mapping-key.ts` yang belum sempat
   dibaca di sesi ini. Konfirmasi apakah `CashflowSyncPanel`
   (`mainTabs`) sudah ditambah entry tab "Mapping" yang merender
   `FieldMappingTab`.
2. Kalau UI tab Mapping sudah solid: uji end-to-end nyata di
   `tauri dev` (isi mapping untuk beberapa key, jalankan sync, cek
   `note`/`category_id` transaksi hasil sync benar-benar terisi sesuai
   mapping, fallback default tetap jalan untuk key yang belum diatur).
3. **Mode ketiga (breakdown PPOB/Consignment)** — key mode ini BELUM
   dirancang sama sekali (sengaja ditunda, "coba begini dulu selama
   beberapa hari sambil mengembangkan mode ketiga"). Bahan sudah
   lengkap: 3 field baru MCP (`isProviderPayoutAccount`/`productTypes`/
   `nonRevenuePortion`) sudah live di server, tinggal dirancang
   bagaimana key/UI-nya menyatu dengan arsitektur `retailku_sync_field_mapping`
   yang sudah ada.
4. **Bug AR/AP idempotency** (UNIQUE constraint saat auto-sync ulang di
   hari sama) — user eksplisit minta dibahas terpisah, BELUM
   diperbaiki. `lastAutoSyncDate` di `settings` masih tanggal lama di
   database dev saat sesi ini berakhir (belum di-fix manual, sesuai
   keputusan "nanti saja").
5. Migrasi `hooks/use-entity-form.ts` lama → versi baru — masih
   terbuka dari handover-handover sebelumnya, belum disentuh lagi.

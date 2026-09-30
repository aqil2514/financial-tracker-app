# Handover — 2026-09-26 (sesi 2)

Lanjutan dari `2026-09-26-1-refactor-struktur-sync-cashflow-mapping-config-sync.md`
(sesi pagi, murni refactoring struktural, TIDAK menyentuh logic AR/AP).
Sesi ini AKHIRNYA menjawab pertanyaan yang tertunda sejak handover
2026-09-24: **apa persis yang membuat sync AR/AP "belum bisa dikatakan
oke"** — jawabannya BUKAN satu bug tunggal, tapi berujung menemukan gap
arsitektural yang lebih besar dari perkiraan awal.

## Ringkasan alur sesi (urutan penting, karena arahnya berbelok signifikan)

1. **Verifikasi end-to-end manual** (permintaan awal user) — dimulai
   dengan baca `docs/rules/checking-dev-database.md`, ambil baseline
   `finance.dev.db` (+ WAL/SHM), lalu user coba sync manual via app.
   Ditemukan & DIVERIFIKASI BENAR: transaksi `id 5575` (utang
   consignment Rp 6.000 dari `SL-260926-05`, 26 Sept) tercatat dengan
   `debts`/`debt_payments` yang konsisten — arah transfer, kontak
   generik, `debtAction: "payable"` semua sesuai desain di
   `retailku-ar-ap-via-cashflow-detail.md`. **Sebelumnya sempat salah
   duga transaksi ini "kemarin" (25 Sept) — DIKOREKSI lewat cross-check
   MCP langsung: transaksinya memang 26 Sept, bukan 25 Sept.**

2. **User ungkap alasan sesungguhnya "belum oke"**: *"kalau di Retailku,
   pelunasan atau penambahan utang piutang itu tidak terpaku dari 1
   akun saja"* — field "Akun Kas untuk Utang Piutang" (1 akun kas
   generik, mis. selalu "BRI") itu SALAH KONSEP, karena transaksi AR/AP
   riil Retailku bisa lewat metode pembayaran APA PUN (Kas Tunai,
   Seabank, dst) tergantung transaksi aslinya.

3. **3 iterasi solusi dicoba, 2 GAGAL, 1 jadi TITIK TERANG**:
   - **Gagal #1**: reuse `retailku_sync_field_mapping` apa adanya
     (ambil representatif `summary:inflow:%`) — DITEMUKAN RAPUH: akun
     Retailku yang SAMA ("Kas Tunai") bisa dipetakan ke akun lokal
     BERBEDA tergantung mode (`summary` vs `detail`), diverifikasi
     nyata ke `finance.dev.db` (lokal 51 vs lokal 30).
   - **Gagal #2**: pairing otomatis dari `journal_items` mentah (cari
     baris kas lain dalam journal entry yang sama via
     `sourceNumber`+timestamp) — BEKERJA utk `sourceType` settlement
     murni (`CONSIGNMENT_SETTLEMENT`, `KS-260908-01`, entry cuma 2
     item), TAPI GAGAL utk `sourceType: SALE` — DIVERIFIKASI ke toko
     RIIL "Warung Aqil" via **docker** (`multi-retail-db`, akses
     langsung `psql` — user nyalakan docker dev Postgres pertengahan
     sesi supaya verifikasi bisa lebih dalam dari sekadar MCP):
     `SL-260620-01` py 5 item jurnal sekaligus (kas+payout
     provider+piutang+revenue+HPP), nilai kas TIDAK match 1:1 ke nilai
     piutang.
   - **Titik terang**: `SalePaymentLine` (Prisma model
     `sale-transaction.prisma`, `saleTransactionId+accountId+amount`)
     ditemukan sbg sumber AKURAT khusus `sourceType: SALE` — PERSIS
     metode pembayaran yg diterima dari pelanggan, tidak tercampur
     payout-provider/HPP. Diverifikasi via query `psql` langsung.

4. **User perluas ke kasus `FUND_TRANSFER`** (transfer dana antar akun
   Retailku) — DITEMUKAN kasus SEJENIS tapi LEBIH SEDERHANA:
   `get_cashflow_detail` memecah 1 transfer jadi 2 baris independen
   (`sourceType: "FUND_TRANSFER"`, `TRF-260919-01` diverifikasi lewat
   MCP `get_fund_transfer_list`/`get_cashflow_detail`), sync SEKARANG
   salah memperlakukan sbg 2 `income`/`expense` terpisah padahal itu
   SATU transfer. MCP tool terpisah (`get_fund_transfer_detail`) SUDAH
   punya `fromAccount`+`toAccount` eksplisit.

5. **Kesimpulan bergeser dari "perbaiki AR/AP" jadi "bangun arsitektur
   umum"**: pola 1-akun (`key = <accountId>:<sourceType>:<arah>`) TIDAK
   CUKUP UMUM — tiap `sourceType` bisa butuh jumlah akun beda, sumber
   data tambahan beda. Solusi: **skema per-`sourceType`, dikelompokkan
   generik vs spesial, dibangun BERTAHAP** (bukan sekaligus semua) —
   fallback aman utk `sourceType` yang belum diklasifikasikan: SKIP +
   DIALOG KONFIRMASI eksplisit ke user (bukan toast pasif).

6. **Riset pola form existing** (via subagent Explore) — preseden
   SATU-SATUNYA form multi-bentuk di codebase
   (`features/transactions/form/add-edit/`) TIDAK PERNAH pakai
   `z.discriminatedUnion` (pakai flat-object + `superRefine` +
   `useWatch` + JSX ternary). User TETAP MEMILIH `discriminatedUnion`
   utk skema baru ini (keputusan sadar, demi type-safety compile-time
   antar `sourceType` yang field wajibnya beda-beda) — TAPI mekanisme
   RENDER form (JSX ternary, wrapper `form-fields` existing) TETAP
   dipertahankan, itu lapisan terpisah dari skema.

7. **Dokumen plan lama ditutup, digantikan dokumen baru** — sesuai
   permintaan user: `retailku-ar-ap-via-cashflow-detail.md` DITUTUP
   (penanda jelas di puncak file, isi historis dipertahankan APA
   ADANYA, JANGAN dihapus) — digantikan
   `retailku-dynamic-sourcetype-mapping.md` (BARU, dokumen utama untuk
   lanjutan kerja ini).

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

**`DRY_RUN = true` MASIH AKTIF** di
`apps/desktop/src/features/retailku/sync-cashflow/shared/sync/cashflow/sync-cashflow.ts`
(baris ~12) — dipasang sesi ini utk investigasi (user minta bisa klik
"Sync Sekarang" berkali-kali TANPA menulis apa pun ke `finance.dev.db`,
cuma `console.log` tiap baris yang seharusnya di-insert + `plan.rows`/
`plan.arApRows` LENGKAP termasuk yang di-skip). **TOAST "BERHASIL"
TETAP MUNCUL DI UI WALAU TIDAK ADA YANG DITULIS KE DATABASE** — kalau
lupa dimatikan, ini bug diam-diam yang menyesatkan (sync tidak pernah
benar-benar jalan tapi kelihatan sukses).

**Tidak ada perubahan lain ke kode produksi** sesi ini — SEMUA
eksplorasi murni lewat MCP (`get_cashflow_detail`, `get_ar_ap`,
`get_finance_accounts`, `get_fund_transfer_list`) + query langsung ke
docker `multi-retail-db` (read-only, TIDAK ada tulis ke database
Retailku). Perubahan `get-cfr-detail.helper.ts` (retail-multitenant,
percobaan #2 "pairing journal_items", field `cashAccounts`) MASIH ADA
di working tree repo `retail-multitenant` — TAPI SUDAH DIANGGAP
DITOLAK/GAGAL PENDEKATANNYA (lihat poin 3 di atas), belum di-revert,
biarkan APA ADANYA sampai keputusan final berikutnya (mungkin
direvisi total, bukan cuma dihapus, tergantung arah `SalePaymentLine`
vs pairing yang dipilih nanti utk `sourceType` settlement).

## Dokumen yang berubah sesi ini

- `docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md` — DITUTUP
  (penanda status di puncak file), isi lain TIDAK diubah.
- `docs/todos/plan/retailku-dynamic-sourcetype-mapping.md` — **BARU**,
  dokumen utama. Berisi: latar belakang 4 temuan, prinsip rancangan,
  riset pola form (WAJIB diikuti utk RENDER, TIDAK utk skema —
  skema pakai discriminatedUnion), struktur tabel mapping saat ini +
  keterbatasannya, tabel kandidat `sourceType`, **strategi eksekusi
  bertahap** (generik vs spesial vs skip+dialog), dan 4 keputusan
  (2 SUDAH diputuskan, 2 masih terbuka — lihat di bawah).

## Keputusan yang SUDAH diambil (jangan tanya ulang ke user)

1. Bentuk skema TypeScript: **`z.discriminatedUnion` per `sourceType`**
   (bukan flat+superRefine, MESKI itu preseden codebase — keputusan
   sadar demi type-safety).
2. Cakupan MVP: **bertahap**, `FUND_TRANSFER` sebagai `sourceType`
   spesial PERTAMA (paling sederhana, datanya sudah diverifikasi
   lengkap), sourceType lain (SALE dengan AR/AP, dst) menyusul SATU
   PER SATU setelah `FUND_TRANSFER` selesai & diverifikasi ke
   `finance.dev.db` nyata.
3. Fallback `sourceType` belum diklasifikasikan: **SKIP + dialog
   konfirmasi eksplisit** (bukan diam-diam diproses sbg generik, bukan
   toast pasif).
4. `sourceType` sebagai unit organisasi utama (bukan `role`/`accountCode`
   Retailku) — alasan: financial-app single-entry berbasis peristiwa,
   selaras dgn `sourceType` (peristiwa bisnis), BUKAN dgn akun neraca
   Retailku (artefak double-entry).

## Keputusan yang MASIH TERBUKA (bahas di sesi berikutnya)

1. **Skema kolom `retailku_sync_field_mapping` utk key yang butuh >1
   akun** (FUND_TRANSFER: `fromAccountId`+`toAccountId`) — kandidat:
   kolom `secondary_account_id` baru, TABEL baru terpisah, atau kolom
   JSON (`extra_fields`) fleksibel. User EKSPLISIT bilang ini "diskusi
   terbuka di sesi baru" — JANGAN putuskan sendiri, tanya dulu.
2. Apakah `sourceType` settlement selain `CONSIGNMENT_SETTLEMENT`
   (terutama `SALE_PAYMENT`) AMAN pakai pairing `journal_items` mentah,
   atau JUGA perlu sumber granular serupa `SalePaymentLine` — BELUM
   diverifikasi, jangan diasumsikan aman tanpa dicek dulu (ikuti pola
   verifikasi docker yang sudah terbukti berguna sesi ini).

## Lanjut sesi berikutnya (urutan disarankan, dari `retailku-dynamic-sourcetype-mapping.md`)

1. Diskusikan keputusan terbuka #1 di atas (skema kolom) — WAJIB
   sebelum menulis migrasi apa pun.
2. Definisikan `GENERIC_SOURCE_TYPES` (enum/set eksplisit di kode).
3. Bangun mekanisme deteksi + dialog konfirmasi utk `sourceType` yang
   belum diklasifikasikan.
4. Implementasikan `FUND_TRANSFER` sbg `sourceType` spesial pertama:
   Zod discriminated union schema, form mapping UI (ikuti render
   pattern `transactions/form/add-edit` — `useWatch`+JSX ternary+
   wrapper `@/components/forms/form-fields`), insert sbg transaksi
   `transfer` TUNGGAL (bukan 2 income/expense terpisah spt sekarang).
5. Verifikasi ke `finance.dev.db` NYATA (ikuti
   `docs/rules/checking-dev-database.md` — copy+WAL/SHM, cek migrasi,
   query `transactions`+relasi) SEBELUM lanjut `sourceType` berikutnya.
6. **Set `DRY_RUN = false` lagi** di `sync-cashflow.ts` setelah semua
   di atas selesai (atau lebih awal kalau user mau lanjut testing
   manual dulu sebelum rancangan final — tanya dulu, jangan asumsikan).
7. Cek keputusan terbuka #2 (SALE_PAYMENT vs pairing journal_items).
8. Revisi/tuntaskan perubahan `get-cfr-detail.helper.ts`
   (retail-multitenant, field `cashAccounts`) — saat ini masih versi
   "pairing polos" yang sudah dianggap tidak cukup, PERLU direvisi
   mengikuti keputusan `SalePaymentLine` utk SALE vs pairing utk
   settlement murni (lihat poin 3 alur sesi di atas).

## Catatan proses (feedback untuk sesi berikutnya)

- User berulang kali mengoreksi arah saya lewat pertanyaan pendek yang
  tajam ("coba cek MCP dulu", "data itu dari toko mana?", "sebentar,
  catat dulu") — pola kerja: JANGAN buru-buru eksekusi kode dari
  hipotesis, VERIFIKASI ke data nyata (MCP, lalu docker kalau MCP
  kurang dalam) SEBELUM menyimpulkan sesuatu "pasti benar". Beberapa
  kali kesimpulan awal saya (query salah, generalisasi terburu-buru)
  DIKOREKSI justru oleh temuan verifikasi lanjutan, bukan oleh user
  menegur langsung — artinya cross-check sendiri sebelum melapor itu
  lebih dihargai daripada laporan cepat yang belum tentu akurat.
- User eksplisit minta pendekatan BERTAHAP begitu skala pekerjaan
  ketahuan besar ("tidak masalah [besar], tapi... bertahap, tidak
  langsung sekaligus") — jangan tawarkan "kerjakan semua sekaligus"
  sbg default utk pekerjaan besar, tawarkan pentahapan lebih dulu.

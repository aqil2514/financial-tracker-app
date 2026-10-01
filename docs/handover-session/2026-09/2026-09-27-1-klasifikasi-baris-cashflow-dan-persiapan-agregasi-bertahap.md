# Handover — 2026-09-27 (sesi 1)

Lanjutan dari `2026-09-26-2-verifikasi-ar-ap-dan-rancangan-mapping-dinamis-per-sourcetype.md`
(sesi sebelumnya menutup dgn dokumen rancangan `retailku-dynamic-sourcetype-mapping.md`,
BELUM ada kode). Sesi ini: (1) mulai PoC kode nyata utk `FUND_TRANSFER`,
(2) menemukan bahwa klasifikasi generik/spesial butuh SATU fungsi
terpusat (bukan cuma `sourceType`), dan (3) merapikan struktur
`compute-cashflow-sync.ts` yang sudah membesar. **BELUM lanjut ke
jalur agregasi/insert per klasifikasi baru — itu diminta eksplisit
ditunda ke SESI BARU** (lihat "Lanjut sesi berikutnya" di bawah).

## Ringkasan alur sesi

1. **PoC `FUND_TRANSFER`** (sourceType spesial pertama, sesuai rencana
   sesi lalu) — dibangun sbg komponen TERPISAH (proof-of-concept,
   BELUM terintegrasi ke tab Mapping existing):
   - Wrapper MCP baru `getFundTransferDetail` (`shared/retailku/mcp-tools/get-fund-transfer-detail.ts`)
     — DIVERIFIKASI ke data nyata (`TRF-260919-01`, Warung Aqil) via
     tool `get_fund_transfer_detail` yang ternyata tersedia langsung
     di sesi ini.
   - `contents/mapping/fund-transfer-poc/`: `schema.ts`
     (`z.discriminatedUnion("sourceType", [...])`, 1 varian FUND_TRANSFER,
     `{ fromAccountId, toAccountId }` wajib beda), `use-fund-transfer-mapping-form.ts`
     (RHF + zodResolver, ikut pola `useWatch` seperti `use-transaction-form.ts`),
     `fund-transfer-mapping-form.tsx` (2 `FormFieldCombobox` + panel
     referensi read-only data Retailku asli).
   - **Submit SENGAJA cuma `console.log`** (user eksplisit: "nanti
     aksi submitnya, cukup console.log saja dlu") — TIDAK menulis ke
     DB. Ini BUKAN keterbatasan teknis, tapi keputusan sadar utk
     tahap PoC.
   - **Tombol "Simpan Mapping" di tab Mapping EXISTING (generik) JUGA
     diubah jadi `console.log`** (`use-mapping-draft-save.ts`) — user
     minta SEMUA aksi submit di area sync-cashflow sementara tidak
     menulis ke DB dulu, selaras `DRY_RUN=true` yg sudah aktif dari
     sesi lalu. **INGAT kembalikan ke `saveMapping.mutate(...)` nanti**
     (komentar penjelasan sudah ditulis di kode persis di titik itu).

2. **UI cleanup kecil** — baris navigasi tab angka di atas panel
   Mapping (`TabsList`/`TabsTrigger`/`ScrollArea` horizontal di
   `array-field-tabs.tsx`) DIHAPUS — terbukti redundan dgn panel kiri
   `MappingOverviewPanel` yg sudah navigasi + lebih informatif (nama
   akun, key, badge Terisi/Kosong). `ArrayFieldTabs` sekarang murni
   mekanisme show/hide via `Tabs` shadcn, navigasi datang dari luar.

3. **Refactor `compute-cashflow-sync.ts`** (dari user, bukan diminta
   fitur baru — permintaan langsung "bisa dijadikan satu fungsi
   saja?"/"pisah jadi fungsi tersendiri" berulang kali) — file ini
   sebelumnya ~145 baris jadi 69 baris, orkestrasi murni:
   - `helpers/load-sync-inputs/` (folder BARU) — `loadSyncInputs()`
     gabungkan 3 pemanggilan independen (`fetchAllCashflowDetailRows`,
     `loadFieldMapping`, `loadActivePaymentMethodIds`) via
     `Promise.all` (sebelumnya sequential `await` 3x).
   - `helpers/aggregate/` (folder BARU) — `aggregateTotals(rows, mode)`
     bungkus pemilihan `aggregateByDateAndAccount` vs
     `aggregateByDateAccountAndSourceType` yg sebelumnya inline
     ternary di `compute-cashflow-sync.ts`.
   - `helpers/plan-rows/` (folder BARU) — `buildPlanRows(...)` bungkus
     loop keputusan cashflow biasa (unmapped/deactivated-payment-method/
     already-synced/insert), dipecah lagi jadi file per-jalur
     (`unmapped-plan-row.ts`, dll).
   - `helpers/ar-ap-plan-rows/` (folder BARU) — `buildArApPlanRows(...)`
     pola sama utk loop AR/AP.
   - File lama yg SUDAH dipindah ke dalam folder baru (bukan lagi ada
     di lokasi lama): `fetch-all-cashflow-detail-rows.ts`,
     `load-field-mapping.ts`, `load-active-payment-method-ids.ts`
     (→ `load-sync-inputs/`), `aggregate-by-date-and-account.ts`,
     `aggregate-by-date-account-and-source-type.ts` (→ `aggregate/`).
     `extract-ar-ap-rows.ts`/`is-ar-ap-row-synced.ts` TETAP di lokasi
     lama (masih dipakai `sync-all.ts`/`insert-ar-ap-transaction.ts`
     juga, tidak eksklusif milik `ar-ap-plan-rows/`).

4. **TEMUAN UTAMA sesi ini — klasifikasi baris butuh 1 fungsi
   terpusat, `sourceType` sendirian TIDAK CUKUP**: dipicu pertanyaan
   user "kalau merujuk dokumen [retailku-dynamic-sourcetype-mapping.md],
   patokannya sourceType ya?" — DIVERIFIKASI nyata (cashflow detail
   kemarin, 26 Sept 2026, Warung Aqil) bahwa `sourceType: "SALE"` yang
   SAMA bisa hasilkan baris dgn peran ekonomi BERBEDA dalam SATU
   transaksi (`SL-260926-02`/`SL-260926-09`: baris Seabank
   `isProviderPayoutAccount:true` = payout PPOB, bukan pendapatan,
   meski sourceType-nya SALE). Solusi: `classify-cashflow-row.ts`
   (BARU) — `classifyCashflowRow(row): "generic"|"ar-ap"|"provider-payout"|"consignment"|"transfer"`,
   SATU sumber kebenaran dipakai baik utk EXCLUDE (fungsi agregasi
   generik skip yg bukan generic) maupun (nanti) INCLUDE (jalur
   ekstraksi khusus per klasifikasi). Detail LENGKAP tiap klasifikasi
   (syarat kode persis + bukti data nyata) ada di dokumen referensi
   BARU: `docs/reference/retailku-cashflow-row-classification.md` —
   **BACA INI SEBELUM lanjut sesi berikutnya**, isinya:
   - `ar-ap` — final, matang (`isReceivablePayableAccount`, berbasis
     ROLE `AccountMapping.role` BUKAN kode akun — dikoreksi user
     eksplisit saat draft awal salah sebut "kode akun").
   - `provider-payout` — final (syarat `isProviderPayoutAccount &&
     sourceType==="SALE"`, BUKAN flag sendirian — dibuktikan
     `isProviderPayoutAccount` itu ATRIBUT AKUN level Retailku, bisa
     `true` di FUND_TRANSFER/INVESTMENT_TRANSACTION juga kalau akunnya
     kebetulan sama, mis. Seabank).
   - `consignment` — final (`consignmentPayablePortion > 0`, KHUSUS
     baris KAS SALE yg py item consignment, bukan baris "Hutang ke
     Penitip" itu sendiri yg sudah ketangkap `ar-ap` lebih dulu).
   - `transfer` — final utk FUND_TRANSFER, SEMENTARA jg menampung
     INVESTMENT_TRANSACTION (financial-app blm py tipe akun investasi
     sendiri — user eksplisit: "ini bisa diklasifikasikan juga? Ini
     sementara masuk ke transfer saja dulu").
   - `generic` — fallback, TERMASUK `PURCHASE_ORDER` (dikonfirmasi TDK
     bawa breakdown item — jurnalnya HANYA uang muka 1 akun tetap,
     item PO baru "direalisasikan" nanti saat PURCHASE_RECEIVING) dan
     `DIRECT_PURCHASE`/`PURCHASE_RECEIVING` TANPA sisa utang (tapi
     BAWA field baru `itemTypes`, lihat poin 5).
   - `CASH_OPNAME` — final `generic`, TAPI py catatan penting: field
     `thirdPartyFunds` (dana titipan numpang fisik di kas, mis.
     konsinyator/tabungan orang lain) SENGAJA TIDAK PERNAH dijurnal
     Retailku — user KONFIRMASI itu BENAR secara akuntansi (dana bukan
     milik toko, tidak masuk neraca), BUKAN gap/bug Retailku spt sempat
     saya (asisten) salah simpulkan di awal.

5. **Server `retail-multitenant` DIUBAH** (repo TERPISAH dari
   financial-app, di luar working directory utama sesi ini) — 3 field
   baru ditambahkan ke `get_cashflow_detail` (helper:
   `apps/api/src/helpers/services/finance/cashflow-report/get-cfr-detail.helper.ts`,
   tool desc: `apps/api/src/helpers/mcp/finance/cashflow/get-cashflow-detail.ts`),
   SEMUA backward-compatible (field lama `nonRevenuePortion` DIPERTAHANKAN):
   - `providerPayoutPortion` + `consignmentPayablePortion` — PEMISAHAN
     `nonRevenuePortion` lama per tipe (PPOB vs CONSIGNMENT terpisah,
     krn `nonRevenuePortion` menjumlahkan KEDUANYA kalau satu transaksi
     py kedua tipe sekaligus — potensi salah hitung yg BELUM pernah
     kejadian di data nyata tapi struktural mungkin).
   - `itemTypes` (array `STOCK`/`SUPPLY`/`ASSET`/`RAW_MATERIAL`) —
     MENCAKUP `DIRECT_PURCHASE` DAN `PURCHASE_RECEIVING` sekaligus
     (SATU field, bukan 2 field terpisah — user eksplisit minta
     digabung stlh saya tunjukkan `getDebitAccountForItem` di kedua
     sourceType itu IDENTIK persis). **PENTING**: `PURCHASE_RECEIVING`
     yg LUNAS PENUH via uang muka (`payableAmount:0`) TIDAK PERNAH
     muncul sama sekali di `get_cashflow_detail` (kedua sisi jurnalnya
     bukan akun kas/bank/piutang/utang) — DIBUKTIKAN nyata via docker
     `multi-retail-db` (psql langsung + `get_journal_list`): SEMUA 12
     PURCHASE_RECEIVING toko Warung Aqil bulan Sept 2026 `payableAmount:0`,
     TIDAK SATUPUN muncul di cashflow. `itemTypes` utk PURCHASE_RECEIVING
     baru KELIHATAN kalau ada sisa utang dagang (`payableAmount>0`) —
     diverifikasi ke kasus lama (`GR-260718-02`, 18 Jul 2026, docker).
   - **Server SUDAH di-restart user, SEMUA field baru SUDAH live &
     TERVERIFIKASI ke data nyata** (bukan cuma type-check) — lihat
     detail verifikasi di dokumen referensi.

6. **`account-type.md` DIPERKAYA** dgn 3 kandidat tipe akun baru,
   SEMUA muncul dari temuan sesi ini (BELUM diputuskan final, cuma
   ditambah sbg kandidat + alasan): `advance` (uang muka — dari
   PURCHASE_ORDER→PURCHASE_RECEIVING), `investment` (dari
   INVESTMENT_TRANSACTION yg sementara menumpang `transfer`),
   `third_party` (dari CASH_OPNAME `thirdPartyFunds`). Ditambah 1
   baris baru di "Belum diputuskan": apakah `advance`/`third_party`
   benar2 layak jadi `account_type` terpisah atau cukup direpresentasikan
   cara lain — BELUM diputuskan, sengaja dibiarkan terbuka.

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **`DRY_RUN = true` MASIH AKTIF** di `sync-cashflow.ts` (dari sesi
  lalu, TIDAK disentuh sesi ini).
- **Tombol "Simpan Mapping" tab Mapping EXISTING (generik) SEKARANG
  JUGA cuma `console.log`** (`use-mapping-draft-save.ts:handleSave`,
  BARU sesi ini) — SEBELUMNYA aksi PENUH (INSERT/UPDATE nyata ke
  `retailku_sync_field_mapping`). User MINTA ini sementara utk selaras
  DRY_RUN. **Cara kembalikan**: baca komentar persis di titik itu di
  kode (`// Kembalikan ke saveMapping.mutate(...) setelah selesai.`).
- **PoC `fund-transfer-poc/` BELUM di-mount ke route/halaman apa pun**
  — TIDAK muncul di UI app sama sekali, murni komponen berdiri sendiri
  siap dipakai kalau mau di-test manual.
- Tidak ada perubahan skema DB (`retailku_sync_field_mapping`) sesi
  ini — Keputusan terbuka #2 dari sesi lalu (kolom utk key >1 akun)
  **MASIH BELUM DIBAHAS**, TETAP terbuka.

## Dokumen yang berubah/baru sesi ini

- `docs/reference/retailku-cashflow-row-classification.md` — **BARU**,
  folder `docs/reference/` jg BARU (belum pernah ada sebelumnya). User
  EKSPLISIT minta lokasi ini, BUKAN `docs/todos/plan/` — alasan
  eksplisit: "plan ini untuk sesuatu yang belum dikerjakan dan jika
  sudah akan pindah ke done. Ini lebih ke referensi". Isinya WAJIB
  dibaca sebelum lanjut jalur agregasi per klasifikasi (lihat poin 4
  di atas) — MURNI klasifikasi (apa+kenapa+bukti data), SENGAJA TIDAK
  membahas kode/status implementasi/PoC (user eksplisit minta
  dibersihkan dari itu: "ini jangan bahas kode atau apapun. Cukup
  referensi row klasifikasi saja").
- `docs/todos/plan/account-type.md` — diperkaya 3 kandidat tipe akun
  (lihat poin 6).
- `docs/todos/plan/retailku-ar-ap-via-cashflow-detail.md` — muncul di
  `git status` sbg modified, TAPI TIDAK diedit sesi ini (kemungkinan
  residual dari sesi sebelumnya, cek `git diff` kalau perlu pastikan).

## Keputusan yang SUDAH diambil sesi ini (jangan tanya ulang)

1. Klasifikasi baris cashflow: 1 fungsi terpusat
   (`classifyCashflowRow`), BUKAN filter tersebar di tiap tempat yg
   butuh. 5 kategori final: `generic`/`ar-ap`/`provider-payout`/
   `consignment`/`transfer` (INVESTMENT_TRANSACTION SEMENTARA di
   `transfer`).
2. `itemTypes` DIGABUNG 1 field utk DIRECT_PURCHASE+PURCHASE_RECEIVING
   (bukan 2 field terpisah) — krn logic penentuan akun debitnya
   IDENTIK di kode server.
3. Field baru server (`providerPayoutPortion`/`consignmentPayablePortion`/
   `itemTypes`) SEMUA backward-compatible, TIDAK menghapus field lama.
4. Dokumen klasifikasi row TERPISAH dari dokumen rancangan mapping
   (`docs/reference/` vs `docs/todos/plan/`) — beda tujuan, jangan
   digabung lagi ke depannya.
5. PoC FUND_TRANSFER: submit console.log SAJA, TIDAK terintegrasi ke
   tab Mapping existing, BELUM ada tabel DB utk key 2-akun.

## Lanjut sesi berikutnya (EKSPLISIT diminta jadi SESI BARU TERPISAH)

User eksplisit: *"Tulis dulu deh di session handover. Kita akan mulai
ini di sesi baru, semua diskusi, keputusan, dsb. Juga ada di sesi baru
nanti"* — artinya diskusi urutan/pendekatan jalur agregasi BELUM
terjadi sama sekali sesi ini, JANGAN asumsikan arah tertentu sudah
disepakati. 3 kandidat titik mulai yang SUDAH diidentifikasi (BELUM
dipilih):

1. **`transfer` (FUND_TRANSFER)** — PALING DEKAT selesai, PoC
   schema+form+wrapper MCP SUDAH ada dari sesi ini, TINGGAL:
   sambungkan ke jalur agregasi (skip di `aggregate/*` SUDAH ada lewat
   `classifyCashflowRow`, tapi BELUM ada `extractTransferRows`/
   `buildTransferPlanRows` spt pola `ar-ap-plan-rows/`), keputusan
   skema kolom DB (Keputusan terbuka #2 sesi 26 Sept, MASIH terbuka),
   baru integrasi form ke tab Mapping (kalau memang mau, atau tetap
   proof-of-concept dulu — BELUM diputuskan).
2. **`provider-payout`** — MULAI DARI NOL, belum ada rancangan sama
   sekali soal bentuk insert-nya (kemungkinan expense/pengeluaran ke
   akun "beban payout provider", tapi BELUM dibahas/diputuskan).
3. **`consignment`** — MULAI DARI NOL, belum ada rancangan cara
   hitung "pendapatan bersih toko" (nilai kas UTUH dikurangi
   `consignmentPayablePortion`?) atau bentuk insert-nya.

Sebelum pilih salah satu, WAJIB baca ulang
`docs/reference/retailku-cashflow-row-classification.md` (rujukan
lengkap tiap klasifikasi) DAN `docs/todos/plan/retailku-dynamic-sourcetype-mapping.md`
(rancangan discriminatedUnion, keputusan terbuka #1-6 dari sesi 26
Sept yg SEBAGIAN BESAR masih belum terjawab).

## Catatan proses (feedback untuk sesi berikutnya)

- User BERULANG KALI minta refactor "bisa dijadikan satu fungsi saja?"
  utk blok kode yg terasa panjang/campur tanggung jawab — pola kerja:
  TAWARKAN pemecahan jadi folder+file kecil per tanggung jawab (spt
  `plan-rows/`, `ar-ap-plan-rows/`) begitu terlihat 1 fungsi mengurus
  >1 hal, JANGAN tunggu diminta eksplisit tiap kali.
- User mengoreksi LANGSUNG saat saya (asisten) salah simpulkan sesuatu
  sbg "gap"/"bug" tanpa verifikasi cukup dalam — 2x kejadian sesi ini:
  (1) saya sempat simpulkan CASH_OPNAME `thirdPartyFunds` tak dijurnal
  itu gap Retailku, DIKOREKSI itu justru benar scr akuntansi; (2) saya
  sempat sebut AR/AP dicek dari "kode akun", DIKOREKSI itu sebenarnya
  dicek dari ROLE (`AccountMapping.role`), kode akun cuma konvensi yg
  BISA beda per toko. Pola: SELALU verifikasi ke source code Retailku
  langsung (bukan cuma data MCP) sebelum menyimpulkan sesuatu "gap"
  atau "sudah pasti begini" — sejalan dgn feedback sesi 26 Sept yg
  sudah tercatat sebelumnya.
- User eksplisit pisahkan 2 jenis dokumen: `docs/reference/` (fakta
  hidup, terus diupdate, TIDAK PERNAH "selesai") vs `docs/todos/plan/`
  (rencana kerja, PINDAH ke `done/` kalau selesai) — JANGAN campur
  keduanya. Dokumen referensi jg diminta SENGAJA dibersihkan dari
  pembahasan kode/status implementasi — murni fakta domain.
- User mengonfirmasi docker `multi-retail-db` boleh dipakai bebas utk
  eksplorasi lebih dalam saat MCP kurang cukup (sejalan pola sesi 26
  Sept) — container butuh waktu ~30-90 detik utk recovery kalau baru
  distart ulang (`FATAL: the database system is starting up`), tunggu
  `pg_isready` sebelum query. User: `aqil_user`, DB: `multi_retail_db`.

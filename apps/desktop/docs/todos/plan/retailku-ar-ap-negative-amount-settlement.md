# AR/AP `amount < 0` — bedakan reversal vs pelunasan asli

Turunan dari gap #1 di
`docs/handover-session/2026-09-28-3-bangun-ulang-sync-ar-ap-dan-opsi-timpa-ulang.md`
("Pelunasan/reversal, `row.amount < 0` — skip eksplisit"). Dokumen ini
mulai dari sesi yang menyelidiki gap itu (2026-09-28, sesi lanjutan) —
riwayat sebelumnya baca handover di atas.

## Latar belakang

Baris AR/AP dengan `amount < 0` (kredit di akun piutang / debit di
akun utang) SEBELUMNYA di-skip semua dengan 1 alasan digabung
(`negative-amount-not-supported`), karena `amount < 0` bisa berarti 2
hal yang berbeda secara ekonomi dan TIDAK bisa dibedakan hanya dari
`debit`/`credit`/`sourceType`:

1. **Reversal** — transaksi (mis. `SALE`) dibalik oleh transaksi lain.
   Piutang/utangnya BATAL, tidak pernah jadi kas. `sourceType`-nya
   SAMA dengan transaksi normal yang menciptakan piutang (mis. `SALE`
   juga muncul 51× sebagai piutang baru yang valid) — sourceType
   sendirian TIDAK CUKUP untuk mendeteksi ini.
2. **Pelunasan asli** — piutang/utang dibayar, kas benar-benar
   berpindah (`sourceType`: `SALE_PAYMENT`, `PURCHASE_PAYMENT`,
   `CONSIGNMENT_SETTLEMENT`, `LEDGER_ENTRY_PAYMENT`, dll).

Diverifikasi ke data nyata Warung Aqil (docker `multi-retail-db`,
query `journal_entries`/`journal_items` langsung): 141 baris AR/AP,
57 bertanda negatif — 10 di antaranya reversal (`reversedByJournalEntryId`
terisi di jurnal aslinya, status jurnal TETAP `POSTED` bukan `VOIDED`),
sisanya pelunasan asli. Korelasi tanda negatif ⟺ reversal/pelunasan
100% konsisten dengan `reversedByJournalEntryId`, 0 pengecualian di
sampel ini — tapi field itu SEBELUM sesi ini belum di-expose ke MCP
tool `get_cashflow_detail` sama sekali.

## Checklist

### Sudah dikerjakan (sesi ini, 2026-09-28)

- [x] Investigasi database Retailku (docker `multi-retail-db`,
  `journal_entries`/`journal_items`/`account_mappings`) — konfirmasi
  kasus reversal DAN pelunasan asli keduanya benar-benar terjadi di
  data nyata Warung Aqil, bukan cuma hipotetis.
- [x] Temukan bahwa `status: 'VOIDED'` SUDAH otomatis tersaring keluar
  oleh filter query di `get-cfr-detail.helper.ts`
  (`where: { status: 'POSTED' } `) — void manual BUKAN gap, sudah aman
  tanpa perubahan apa pun.
- [x] Temukan bahwa reversal (`reversedByJournalEntryId` terisi) TIDAK
  ikut tersaring — entry asli tetap `POSTED`, cuma "dibalik" oleh
  entry lain — dan field itu belum ter-select/ter-expose sama sekali.
- [x] **Sisi `retail-multitenant`** (`apps/api/src/helpers/services/finance/cashflow-report/get-cfr-detail.helper.ts`):
  tambah `reversedByJournalEntryId` ke `select` query jurnal, expose
  sebagai field baru `isReversed: boolean` di setiap baris response
  (berlaku utk SEMUA baris, bukan cuma AR/AP — reversal bisa terjadi
  di jurnal apa pun).
- [x] Update deskripsi tool MCP `get_cashflow_detail`
  (`get-cashflow-detail.ts`) menjelaskan field baru + kapan harus
  dipakai.
- [x] `npx nest build` di `apps/api` (retail-multitenant) — sukses,
  cuma 2 file berubah.
- [x] Restart server (dilakukan USER), diverifikasi LANGSUNG via
  panggilan tool `get_cashflow_detail` nyata (bukan simulasi) — baris
  `SL-260808-12` (piutang direversal) `isReversed: true`, baris
  `SP-260809-01` (pelunasan asli, `SALE_PAYMENT`) `isReversed: false`
  — dua kasus dengan tanda negatif identik SEKARANG terbedakan benar.
- [x] **Sisi `financial-app`**:
  - `shared/retailku/mcp-tools/cashflow/get-cashflow-detail.ts` — tambah
    field `isReversed: boolean` ke tipe `RetailkuCashflowDetailRow`.
  - `helpers/extract-ar-ap-rows.ts` — alirkan `isReversed` ke `ArApRow`.
  - `types.ts` — `ArApSkipReason`: ganti 1 reason lama
    (`negative-amount-not-supported`) jadi 2 reason baru: `"reversal"`
    dan `"settlement-not-supported"`.
  - `helpers/ar-ap-plan-rows/negative-amount-plan-row.ts` — pilih
    skipReason berdasarkan `row.isReversed`.
  - Test: pecah 1 test case lama jadi 2 (reversal vs
    settlement-not-supported), tambah `isReversed` ke row factory test.
  - Verifikasi: `npx tsc --noEmit` bersih, `npx vitest run` 122/122
    lulus (naik dari 121 baseline sesi sebelumnya).
- [x] **Tabel preview AR/AP** di dialog Preview Sync
  (`config/contents/preview-sync-section.tsx`) — sebelumnya CUMA
  tabel "Pergerakan Kas" (cashflow biasa) yang tampil, `arApExistingMode`
  sudah disalurkan ke `computeCashflowSync` tapi hasilnya tidak
  ditampilkan. Sekarang ditambah seksi "Piutang / Utang": 4 summary
  stat (piutang/utang baru, akan ditimpa ulang, di-skip, akun belum
  dipetakan) + tabel per baris (tanggal, akun, pihak, nominal, status)
  dengan badge utk semua 6 kemungkinan status (`willInsert`,
  `willUpdate`, 5 `skipReason` termasuk `reversal`/
  `settlement-not-supported` yang baru). Export `ArApSyncPlan`/
  `ArApSyncPlanRow` ditambah ke barrel `cashflow/index.ts` dan
  `shared/sync/index.ts` supaya bisa diimpor komponen UI. Verifikasi:
  `tsc --noEmit` bersih, `vitest run` 122/122 lulus, DAN diverifikasi
  VISUAL langsung oleh user di `tauri dev` nyata (screenshot: baris
  "Nenek Petok" tampil `-Rp2.000` dengan badge "Pelunasan (belum
  didukung)", baris "Mba-mba Kado Kuning" tampil `Rp1.500`/`Rp6.000`
  dengan badge "Piutang/utang baru" — sesuai data yang sama yang
  diverifikasi di handover sesi 3).
- [x] **Representasi pelunasan asli ke `debts` — KHUSUS piutang dagang
  (`SALE_PAYMENT`)**:
  - Riset skema Postgres retailku (`sale_payments`, `purchase_payments`,
    `ledger_entry_payments`, `consignment_settlements`) — konfirmasi
    link BALIK ke transaksi asli SUDAH ADA di skema (FK langsung),
    cuma belum di-expose. `sale_payments.saleTransactionId` paling
    sederhana (1 FK langsung) — dipilih sebagai kasus pertama.
  - Konfirmasi ke data nyata Warung Aqil: pelunasan PARSIAL/multi-cicilan
    BENAR-BENAR terjadi (satu piutang dibayar sampai 3× terpisah),
    bukan cuma hipotetis — skema `debt_payments` (0012_debts.sql) SUDAH
    dirancang persis untuk pola ini (`debts.amount` = pokok tetap,
    `debt_payments` = tiap cicilan, sisa = pokok − Σcicilan), TIDAK
    perlu migrasi baru untuk struktur itu sendiri.
  - **Sisi `retail-multitenant`** (`get-cfr-detail.helper.ts`): tambah
    `salePayment.saleTransaction.journalEntry.items` (difilter
    `receivablePayableAccountIds` yang sudah ada) ke query, expose
    field baru `settledReceivablePayableJournalItemId: string | null`
    — HANYA terisi utk baris `sourceType: SALE_PAYMENT`, berisi id
    journal item piutang ASLI yang dilunasi. Deskripsi tool MCP
    diupdate. `npx nest build` sukses. Restart server (USER),
    diverifikasi LANGSUNG via panggilan nyata: baris `SP-260809-01`
    `settledReceivablePayableJournalItemId` PERSIS sama dengan
    `journalItemId` baris `SL-260809-07` (piutang asli, "Adel").
  - **Migrasi baru** `0026_debt_payments_source_ref.sql` — kolom
    `source`/`source_ref` di `debt_payments`, pola PERSIS
    `debts.source`/`source_ref` (0025) — didaftarkan di
    `migrations.rs` (version 26), `cargo check` sukses.
  - **Sisi `financial-app`**: `RetailkuCashflowDetailRow`/`ArApRow`
    tambah field baru; `types.ts` tambah skip reason
    `"settled-debt-not-found"` (link ADA tapi piutang aslinya belum
    pernah sync) + field `willInsertPayment`/`paymentDebtId` di
    `ArApSyncPlanRow`; `buildArApPlanRows` — cabang baru: kalau
    `amount<0`, bukan reversal, DAN link ADA → cari `debts` via
    `source_ref`, ketemu → `settlementPlanRow`, tidak ketemu →
    `settledDebtNotFoundPlanRow`; helper baru `insertArApPayment` — INSERT
    `debt_payments` (BUKAN `debts`), `amount` dibalik positif,
    `account_id` NULL (representasi kas SENGAJA ditunda, lihat
    keputusan di bawah), `source_ref` = journalItemId baris
    SALE_PAYMENT itu sendiri (beda dari source_ref piutang aslinya);
    `sync-cashflow.ts` loop baru + DRY_RUN log terpisah; `sync-all.ts`
    rollback tambah `DELETE FROM debt_payments WHERE source_ref IN
    (...)` eksplisit (TIDAK ter-cascade dari `debts` karena
    source_ref-nya independen — beda dari cicilan piutang yang SAMA
    baru dibuat di sync yang sama, yang IKUT cascade); preview UI
    (badge "Pelunasan akan tercatat" / "Piutang asal belum
    tersinkron", summary stat baru); toast baru jumlah pelunasan
    tercatat.
  - Verifikasi: `npx tsc --noEmit` bersih, `cargo check` sukses,
    `npx vitest run` 125/125 lulus (naik dari 122 — 3 test baru: 2
    skenario `buildArApPlanRows`, 1 `insertArApPayment`).
  - **Verifikasi end-to-end SEBAGIAN** via `tauri dev` nyata (console
    log user, rentang 2026-09-22 s/d 2026-09-26, Warung Aqil): baris
    "Nenek Petok" (`amount: -2000`, sebelumnya berlabel
    `settlement-not-supported`) SEKARANG `skipReason:
    "settled-debt-not-found"` — konfirmasi cabang baru (link ADA lewat
    `settledReceivablePayableJournalItemId`, lookup ke `debts` via
    `findSyncedArApDebtId` BERJALAN, tapi piutang aslinya belum
    ketemu) jalan benar di data live. Dua baris lain (Mba-mba Kado
    Kuning, `willInsert: true`) TIDAK regresi. **TIDAK bisa** menguji
    cabang "ketemu" (`willInsertPayment: true`) dengan data dev yang
    ada — `debts` lokal sekarang isinya dari fitur "Piutang Retailku"
    LAMA (`source` bukan `retailku_sync`), belum ada satu pun baris
    `source_ref` yang cocok utk dicicil. Cabang itu HANYA tervalidasi
    lewat unit test (`index.test.ts`), BELUM end-to-end — DRY_RUN,
    insert sungguhan (baik `debts` maupun `debt_payments`) belum
    pernah dicoba sama sekali.
- [x] **Representasi pelunasan asli ke `debts` — perluasan ke
  piutang/utang NON-DAGANG (`LEDGER_ENTRY_PAYMENT`)**:
  - Riset skema Prisma (`ledger-party.prisma`) — konfirmasi relasi 1:1
    `JournalEntry.ledgerEntryPayment` (arah KEBALIKAN dari
    `salePayment`: journal entry pelunasan → `LedgerEntryPayment` →
    `ledgerEntry.journalEntry.items`, bukan lewat transaksi sumber).
    Ditemukan juga: SEBAGIAN `ledger_entries` (kasus consignment,
    `sourceType`/`sourceId` terisi) `journalEntryId`-nya `NULL` —
    TIDAK relevan utk kasus ini karena filter `sourceType:
    LEDGER_ENTRY_PAYMENT` di konsumen sudah memisahkan otomatis (kasus
    consignment sourceType-nya `CONSIGNMENT_SETTLEMENT`, beda jalur).
    Konfirmasi ke data nyata: TIDAK ada pelunasan parsial/multi-cicilan
    utk kasus ini di Warung Aqil (beda dari SALE_PAYMENT yang ada),
    dan semua `status: POSTED` (tidak ada `CANCELLED` yang perlu
    difilter tambahan).
  - **Sisi `retail-multitenant`**: tambah relasi
    `ledgerEntryPayment.ledgerEntry.journalEntry.items` ke query
    (filter `receivablePayableAccountIds` sama seperti SALE_PAYMENT),
    `settledReceivablePayableJournalItemId` sekarang isi dari 2 jalur
    (`SALE_PAYMENT` ATAU `LEDGER_ENTRY_PAYMENT`, `null` kalau
    keduanya tidak match). Deskripsi tool MCP diupdate. `npx nest
    build` sukses (2 file sama yang berubah). Restart server (USER),
    diverifikasi LANGSUNG via panggilan nyata (rentang 2026-08-10):
    baris `LEP-260810-01` (Pelunasan Piutang Non-Dagang, akun 1800)
    `settledReceivablePayableJournalItemId` PERSIS sama dengan
    `journalItemId` baris piutang asli "Ayah - Rokok Mang Jaja" —
    DAN sekaligus dikonfirmasi ulang baris `SALE_PAYMENT` (SP-260810-01,
    "Nde Mursan") di rentang yang sama masih resolve benar (tidak ada
    regresi).
  - **Sisi `financial-app`: TIDAK PERLU perubahan kode sama sekali** —
    `buildArApPlanRows` sudah generik (cek
    `settledReceivablePayableJournalItemId != null`, tidak peduli
    `sourceType`), jadi otomatis ikut jalur `settlementPlanRow`/
    `settledDebtNotFoundPlanRow` yang sama begitu server expose field
    untuk sourceType baru.
  - **BELUM** diverifikasi end-to-end via `tauri dev` (baru dicek
    lewat panggilan tool MCP langsung) — dan seperti SALE_PAYMENT,
    cabang "ketemu" (`willInsertPayment: true`) masih belum bisa
    dites karena `debts` lokal belum ada baris `source: retailku_sync`.
- [x] **Representasi pelunasan asli ke `debts` — perluasan ke utang
  dagang (`PURCHASE_PAYMENT`)**:
  - Riset skema Prisma (`purchase-payment.prisma`, `purchase-order.prisma`,
    `purchase-receiving.prisma`) — `PurchasePayment` punya 3 FK opsional
    (`directPurchaseId`/`goodsReceivingId`/`purchaseOrderId`), TAPI
    `PurchaseOrder` SENDIRI TIDAK PUNYA `journalEntryId` (PO bukan
    dokumen jurnal) — utang baru tercatat saat `GoodsReceiving`-nya
    diverifikasi, jadi jalur `purchaseOrderId` perlu turun 1 level lagi
    ke `purchaseOrder.goodsReceivings[0].journalEntry`. Diverifikasi ke
    142 baris `PurchasePayment` nyata (Warung Aqil): SELALU maks 1
    `GoodsReceiving` per PO (0 kasus >1), `[0]` aman dipakai. Ditemukan
    juga pola PENTING: `type: DOWN_PAYMENT` mengkredit "Uang Muka
    Pembelian" (akun 1600, role `PURCHASE_ADVANCE`) BUKAN "Hutang
    Dagang" (2100) — filter `receivablePayableAccountIds` yang SUDAH
    ADA (cuma 6 role AR/AP, TIDAK termasuk `PURCHASE_ADVANCE`) otomatis
    mengembalikan array KOSONG untuk kasus DP murni TANPA logic
    tambahan — pembayaran DP memang bukan pelunasan utang, `null` itu
    benar.
  - **Sisi `retail-multitenant`**: tambah relasi
    `purchasePayment.directPurchase/goodsReceiving/purchaseOrder.goodsReceivings[0].journalEntry.items`
    (3 jalur dicoba berurutan, saling eksklusif — cuma satu FK yang
    pernah terisi per `PurchasePayment`). `settledReceivablePayableJournalItemId`
    sekarang isi dari 3 jalur (`SALE_PAYMENT`/`LEDGER_ENTRY_PAYMENT`/
    `PURCHASE_PAYMENT`). Deskripsi tool MCP diupdate. `npx nest build`
    sukses (2 file sama yang berubah, prettier auto-format nested
    ternary). Restart server (USER), diverifikasi LANGSUNG via
    panggilan nyata (rentang 2026-05-29): baris `PP-260529-01`
    (Pelunasan penerimaan barang - GR-260529-01, akun 2100, `debit:
    19000`) `settledReceivablePayableJournalItemId` PERSIS sama dengan
    `journalItemId` baris `GR-260529-01` (utang asli, "Mawar Store",
    `credit: 19000` — nilai JUGA cocok persis). Sekaligus dikonfirmasi:
    banyak baris `PURCHASE_ORDER` (jalur DP via `purchaseOrderId`) di
    rentang yang sama benar `null` (kredit ke 1600, bukan 2100) —
    sesuai desain, bukan bug.
  - **Sisi `financial-app`: TIDAK PERLU perubahan kode sama sekali**
    (sama seperti LEDGER_ENTRY_PAYMENT) — logic generik otomatis
    mencakup sourceType baru begitu server expose field-nya.
  - **BELUM** diverifikasi end-to-end via `tauri dev`, dan cabang
    "ketemu" (`willInsertPayment: true`) masih belum bisa dites —
    sama seperti 2 sourceType sebelumnya.

**Hasil akhir: reversal MASIH di-skip permanen (memang seharusnya).
Pelunasan asli SEKARANG bisa diproses untuk SEMUA 4 sourceType
(`SALE_PAYMENT`, `LEDGER_ENTRY_PAYMENT`, `PURCHASE_PAYMENT`,
`CONSIGNMENT_SETTLEMENT`) — kalau piutang/utang aslinya sudah pernah
tersinkron (untuk consignment: SEMUA piutang/utang terkait, kebijakan
all-or-nothing). Representasi kas dari pelunasan (akun mana yang
menerima uang) TETAP sengaja ditunda untuk semua kasus —
`debt_payments.account_id` NULL untuk semua baris hasil sync ini,
lihat item terpisah di bawah.**

- [x] **Representasi pelunasan asli ke `debts` — perluasan ke utang
  consignment (`CONSIGNMENT_SETTLEMENT`)**:
  - Riset awal (skema `consignment-settlement.prisma`): jurnal
    `ConsignmentSettlement` cuma 1 baris "Hutang ke Penitip" dgn
    `totalAmount` GABUNGAN — BEDA dari 3 kasus lain (1:1), 1 settlement
    bisa melunasi BANYAK transaksi consignment sekaligus, jurnalnya
    sendiri TIDAK menyimpan rincian per transaksi. Sempat disangka gap
    struktural TIDAK BISA diselesaikan tanpa heuristik (FIFO by date +
    akumulasi ke totalAmount) — **KELIRU**, dikoreksi user yang minta
    dicek dulu apakah Retailku punya data yang cukup sebelum
    memutuskan skip permanen.
  - Riset lanjutan (`get-cs-form-data.helper.ts`, `post-cs.helper.ts`,
    `ledger-entry-no-journal.helper.ts`) menemukan: consignment
    ternyata dicatat lewat `LedgerEntry` (tabel SAMA dgn piutang/utang
    non-dagang manual), BUKAN cuma journal item mentah — server
    Retailku SUDAH menjalankan FIFO eksplisit saat posting settlement
    (`applySettlementToLedger`) dan mencatat 1 `LedgerEntryPayment` PER
    `LedgerEntry` yang dilunasi dgn `sourceType: 'CONSIGNMENT_SETTLEMENT'`
    + `sourceId: settlement.id` — pemetaan yang "hilang" di jurnal
    ternyata MASIH ADA, cuma di tabel lain. TIDAK PERLU heuristik sama
    sekali, murni query.
  - **Percobaan pertama SALAH**: `LedgerEntry.journalEntryId` untuk
    consignment SELALU `NULL` (beda dari ledger manual yg dipakai
    LEDGER_ENTRY_PAYMENT) — journal aslinya lewat `sourceType`/
    `sourceId` POLYMORPHIC milik `LedgerEntry` itu SENDIRI. Diverifikasi
    ke data nyata: 2 pola ditemukan — (1) `sourceType: 'SALE'`,
    `sourceId` = `SaleTransactionItem.id` (BUKAN `SaleTransaction.id`
    langsung — 1 transaksi bisa punya banyak item consignment dari
    penitip berbeda), journal item via
    `saleTransactionItem.saleTransaction.journalEntry.items`; (2)
    `sourceType: 'CONSIGNMENT_LEDGER_MIGRATION'` (saldo awal migrasi
    data lama, TIDAK PERNAH punya transaksi sumber — sengaja dilewati,
    BUKAN bug).
  - **Sisi `retail-multitenant`**: field baru
    `settledReceivablePayableJournalItemIds: {journalItemId, amount}[]`
    (ARRAY OBJEK, BEDA BENTUK dari `settledReceivablePayableJournalItemId`
    yang tunggal) — HANYA terisi utk `CONSIGNMENT_SETTLEMENT`. Query 3
    tahap: (1) kumpulkan `consignmentSettlement.id` dari `entries`, (2)
    query `LedgerEntryPayment` dgn `sourceType`/`sourceId` match
    (SERTAKAN `amount` — nominal PERSIS hasil FIFO Retailku, bukan
    ditebak ulang financial-app), (3) utk yg
    `ledgerEntry.sourceType === 'SALE'`, query lanjutan
    `SaleTransactionItem -> saleTransaction.journalEntry.items`.
    Deskripsi tool MCP diupdate. `npx nest build` sukses tiap iterasi
    (3 file berubah total karena 1 percobaan gagal-perbaiki, +1 lagi
    saat bentuk field diubah dari `string[]` ke objek). Diverifikasi
    LANGSUNG via panggilan nyata: `KS-260908-01` (campuran 1×SALE +
    1×MIGRATION, totalAmount 16500) -> array 1 item (migration sengaja
    dilewati, BENAR); `KS-260918-01` (murni 3×SALE, totalAmount 6000)
    -> array TEPAT 3 item `{1500, 1500, 3000}`, jumlahnya cocok
    totalAmount.
  - **Sisi `financial-app`**: field baru di `ArApSyncPlanRow` —
    `willInsertPayments: {debtId, amount}[]` (beda dari
    `willInsertPayment`/`paymentDebtId` yang cuma 1 debt), skip reason
    baru `"settlement-partially-not-found"`. `buildArApPlanRows` —
    cabang baru SEBELUM cabang 1:1 lama: kalau
    `settledReceivablePayableJournalItemIds.length > 0`, loop tiap
    elemen cari `debts` via `source_ref`, kebijakan **all-or-nothing**
    (dikonfirmasi user): SATU SAJA tidak ketemu -> skip SELURUH baris
    (`settlementPartiallyNotFoundPlanRow`), TIDAK proses partial;
    SEMUA ketemu -> `settlementBatchPlanRow` dgn alokasi lengkap.
    Helper baru `insertArApPaymentsBatch` — INSERT banyak
    `debt_payments` sekaligus, `source_ref` per alokasi digabung
    `debtId` (`${sourceRef}:${debtId}`) supaya tetap unik per baris
    (constraint `idx_debt_payments_source_ref`) — TIDAK perlu
    perubahan skema baru, migrasi 0026 yang sudah ada cukup. Rollback
    (`sync-all.ts`) TIDAK perlu perubahan — `arApPaymentInsertedSourceRefs`
    sudah otomatis pakai format gabungan itu juga. UI preview: summary
    stat baru "Pelunasan konsinyasi", badge baru "Pelunasan konsinyasi
    (N utang)" dan "Sebagian piutang asal belum tersinkron".
  - Verifikasi: `tsc --noEmit` bersih, `cargo check` sukses,
    `vitest run` 129/129 lulus (naik dari 125 — 4 test baru: 2 skenario
    batch di `buildArApPlanRows`, 2 di `insertArApPaymentsBatch`). DAN
    diverifikasi VISUAL oleh user di `tauri dev` nyata (rentang
    2026-09-01 s/d 2026-09-28): `KS-260908-01` (-Rp16.500) DAN
    `KS-260918-01` (-Rp6.000) SAMA-SAMA tampil "Sebagian piutang asal
    belum tersinkron" — BENAR sesuai desain all-or-nothing, karena
    piutang aslinya (termasuk yang baru "akan" dibuat di rentang sync
    yang SAMA, `willInsert: true` tapi belum benar-benar ter-INSERT
    selama DRY_RUN) belum ada satu pun yang tersimpan nyata ke `debts`
    lokal. Sempat terlihat SALAH (skipReason lama
    `settlement-not-supported`) di percobaan pertama karena cache
    dev server belum reload kode terbaru — refresh manual oleh user
    memperbaikinya, BUKAN bug kode.
- [ ] **Representasi kas dari pelunasan** — `debt_payments.account_id`
  NULL sengaja untuk semua baris hasil sync (termasuk SALE_PAYMENT yang
  SUDAH diimplementasikan) — Retailku expose `cashAccounts` di baris
  pelunasan, tapi resolusi ke akun lokal butuh mapping terpisah dari
  mapping AR/AP yang ada sekarang (yang cuma untuk akun piutang/utang,
  bukan akun kas). BELUM didesain.
- [ ] Representasi kas dari DP/split payment (`cashAccounts`) — gap
  lama, TIDAK terkait langsung dengan dokumen ini, tetap seperti
  tercatat di handover sesi 3.
- [ ] `account_type: advance` — masih rencana dokumen terpisah
  (`docs/todos/plan/account-type.md`).
- [ ] DRY_RUN belum dinonaktifkan — semua di atas baru actionable
  setelah keputusan eksplisit user mengaktifkan insert sungguhan.

## Keputusan yang sudah dikonfirmasi user (sesi ini)

- Untuk `amount < 0` yang BUKAN reversal (`isReversed: false`,
  pelunasan asli): **skip dulu**, jangan coba proses sekarang.
  Alternatif yang DITOLAK: cari `debts` existing lewat
  `partyName`+`direction`+akun (bukan link exact) — risiko salah
  pasang kalau 1 pihak punya >1 piutang aktif bersamaan dianggap
  terlalu berisiko untuk sesi ini. **(Keputusan ini KEMUDIAN direvisi
  di sesi lanjutan yang sama — lihat 2 poin di bawah, setelah link
  exact untuk SALE_PAYMENT ditemukan tersedia di skema.)**
- Cakupan implementasi pelunasan: **mulai dari `SALE_PAYMENT` (piutang
  dagang) dulu**, BUKAN keempat sourceType sekaligus — link-nya paling
  sederhana (1 FK langsung) dan datanya paling sering terjadi (39 dari
  57 baris negatif di sampel Warung Aqil). `PURCHASE_PAYMENT`/
  `LEDGER_ENTRY_PAYMENT`/`CONSIGNMENT_SETTLEMENT` ditunda ke sesi
  terpisah supaya scope tidak membengkak sekaligus.
- Akun kas pelunasan (`debt_payments.account_id`): **NULL dulu, gap
  diketahui** — bukan diisi `debtLocalAccountId` piutang/utangnya
  sendiri (opsi lain yang dipertimbangkan tapi TIDAK dipilih, karena
  itu bukan akun kas yang benar, cuma "asal ada nilai"). Representasi
  kas dari pelunasan konsisten ditunda dengan keputusan lama soal
  `cashAccounts` diabaikan total untuk baris piutang baru.

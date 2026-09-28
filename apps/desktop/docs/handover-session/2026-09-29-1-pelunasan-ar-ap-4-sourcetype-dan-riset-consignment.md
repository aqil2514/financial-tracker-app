# Handover — 2026-09-29 (sesi 1)

Lanjutan dari `2026-09-28-3-bangun-ulang-sync-ar-ap-dan-opsi-timpa-ulang.md`.
Sesi ini menyelesaikan gap #1 di handover itu ("Pelunasan/reversal,
`row.amount < 0` — skip eksplisit") — **detail teknis lengkap ada di
dokumen plan `docs/todos/plan/retailku-ar-ap-negative-amount-settlement.md`,
BACA ITU dulu sebelum lanjut apa pun terkait AR/AP** — dokumen ini
cuma ringkasan alur sesi, checklist per-item ada di sana (termasuk
kode/query yang diubah, cara verifikasi, dan keputusan yang
dikonfirmasi user).

## Ringkasan hasil sesi

Awal sesi: SEMUA baris AR/AP `amount < 0` (piutang/utang berkurang)
di-skip 100% dengan 1 alasan digabung (bug lama: reversal dan
pelunasan asli tidak bisa dibedakan). Akhir sesi: **reversal MASIH
di-skip permanen** (benar secara desain), TAPI **pelunasan asli
SEKARANG bisa diproses untuk SEMUA 4 sourceType Retailku**
(`SALE_PAYMENT`, `LEDGER_ENTRY_PAYMENT`, `PURCHASE_PAYMENT`,
`CONSIGNMENT_SETTLEMENT`) — asalkan piutang/utang aslinya sudah pernah
tersinkron ke `debts` lokal.

Pola kerja tiap sourceType: (1) riset skema Prisma `retail-multitenant`
utk cari link balik ke transaksi asli, (2) tambah field baru di
`get-cfr-detail.helper.ts` (`get_cashflow_detail` MCP tool), (3)
restart server, verifikasi ke data Warung Aqil NYATA (bukan simulasi),
(4) sambungkan sisi financial-app (`buildArApPlanRows` dkk).

## Urutan pengerjaan (kronologis)

1. **`isReversed`** — field baru membedakan reversal (piutang/utang
   batal, dari `journal_entries.reversedByJournalEntryId`) vs pelunasan
   asli. `ArApSkipReason` lama `negative-amount-not-supported` dipecah
   jadi `reversal` / `settlement-not-supported`.
2. **Tabel preview AR/AP** ditambahkan ke dialog Preview Sync
   (`preview-sync-section.tsx`) — sebelumnya cuma cashflow biasa yang
   tampil.
3. **`SALE_PAYMENT`** (piutang dagang) — field
   `settledReceivablePayableJournalItemId` (1 ID), link via
   `salePayment.saleTransaction.journalEntry.items`. Migrasi baru
   `0026_debt_payments_source_ref.sql` (kolom `source`/`source_ref` di
   `debt_payments`, pola sama `debts`). Helper baru
   `insertArApPayment` — INSERT `debt_payments` (BUKAN `debts`),
   `debts.amount` pokok tidak disentuh.
4. **`LEDGER_ENTRY_PAYMENT`** (piutang/utang non-dagang) — relasi
   arah KEBALIKAN dari SALE_PAYMENT
   (`ledgerEntryPayment.ledgerEntry.journalEntry.items`). Sisi
   financial-app TIDAK perlu ubah kode (logic sudah generik).
5. **`PURCHASE_PAYMENT`** (utang dagang) — 3 FK opsional
   (`directPurchase`/`goodsReceiving`/`purchaseOrder.goodsReceivings[0]`),
   `PurchaseOrder` sendiri TIDAK punya journal. Ketemu pola penting:
   pembayaran UANG MUKA (kredit ke akun 1600, bukan 2100) otomatis
   `null` tanpa logic tambahan (filter role AR/AP yang sudah ada
   sudah cukup).
6. **`CONSIGNMENT_SETTLEMENT`** (utang consignment, PALING KOMPLEKS) —
   riset awal SALAH duga butuh heuristik (1 settlement = totalAmount
   gabungan, jurnalnya sendiri tidak simpan rincian per transaksi).
   User minta dicek lagi sebelum diputuskan skip permanen — ternyata
   Retailku SUDAH menjalankan FIFO di server (`applySettlementToLedger`)
   dan mencatat rincian per `LedgerEntry` di `LedgerEntryPayment`
   (`sourceType`/`sourceId` polymorphic ke `ConsignmentSettlement.id`).
   Field baru **array objek** `settledReceivablePayableJournalItemIds:
   {journalItemId, amount}[]` (beda bentuk dari field tunggal di 3
   kasus lain). Sisi financial-app: field baru `willInsertPayments`,
   kebijakan **all-or-nothing** (dikonfirmasi user) — satu debt saja
   tidak ketemu, skip SELURUH baris. Helper baru
   `insertArApPaymentsBatch`.

## Verifikasi hasil kerja sesi ini (dilakukan, bukan diasumsikan)

1. **`npx tsc --noEmit`** — bersih di setiap iterasi (financial-app).
2. **`npx vitest run`** — 129/129 lulus (naik dari 121 baseline awal
   sesi — 8 test baru total across semua sourceType).
3. **`cargo check`** — sukses, migrasi `0026` terdaftar di
   `migrations.rs`.
4. **Sisi `retail-multitenant`**: `npx nest build` sukses tiap
   iterasi (4 kali, sekali sempat 1 percobaan gagal-perbaiki untuk
   consignment). Server di-restart USER setiap kali field baru
   ditambah.
5. **Verifikasi LANGSUNG ke data Warung Aqil nyata** (panggilan tool
   MCP `get_cashflow_detail` langsung, bukan simulasi) untuk KEEMPAT
   sourceType — detail lengkap tiap kasus ada di dokumen plan. Semua
   link `journalItemId` cocok persis dengan baris piutang/utang asli
   yang sudah diverifikasi sebelumnya di sesi lalu.
6. **Verifikasi VISUAL di `tauri dev`** (USER langsung, rentang
   2026-09-01 s/d 2026-09-28, Warung Aqil) — tabel preview AR/AP
   menampilkan status yang benar untuk SEMUA kasus, termasuk 2 baris
   `CONSIGNMENT_SETTLEMENT` yang keduanya skip
   "Sebagian piutang asal belum tersinkron" (BENAR sesuai
   all-or-nothing, karena piutang aslinya belum pernah ter-INSERT
   sungguhan selama masih DRY_RUN) — sempat terlihat SALAH di
   percobaan pertama karena cache dev server belum reload, refresh
   manual user memperbaikinya (BUKAN bug kode).

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **Masih `DRY_RUN = true`** di `sync-cashflow.ts` — insert sungguhan
  (baik `debts` maupun `debt_payments`) BELUM PERNAH dicoba sama
  sekali sepanjang sesi ini.
- **Cabang "ketemu" (`willInsertPayment: true` / `willInsertPayments`
  terisi) BELUM PERNAH teruji end-to-end** untuk sourceType manapun —
  `debts` lokal di database dev SEMUANYA berasal dari fitur "Piutang
  Retailku" LAMA (`source` bukan `retailku_sync`), belum ada satu pun
  baris `source_ref` yang cocok utk dicicil. Logic "ketemu" cuma
  tervalidasi lewat unit test, bukan data live.
- **Reversal MASIH skip permanen** — ini keputusan desain final, BUKAN
  gap (piutang/utang yang dibalik memang tidak pernah seharusnya
  tercatat).

## Gap yang TERSISA untuk sesi berikutnya (checklist lengkap di
dokumen plan, jangan cuma baca ringkasan ini)

1. **Representasi kas dari pelunasan** — `debt_payments.account_id`
   NULL sengaja untuk SEMUA baris hasil sync (termasuk 4 sourceType
   yang sudah selesai) — Retailku expose `cashAccounts` di baris
   pelunasan, tapi resolusi ke akun lokal butuh mapping BARU (beda
   dari mapping AR/AP yang cuma untuk akun piutang/utang). BELUM
   didesain sama sekali.
2. Representasi kas dari DP/split payment (`cashAccounts` piutang
   BARU) — gap lama dari sesi 2026-09-28, TIDAK terkait langsung sesi
   ini.
3. `account_type: advance` — masih rencana dokumen terpisah
   (`docs/todos/plan/account-type.md`).
4. DRY_RUN belum dinonaktifkan — semua di atas baru actionable
   setelah keputusan eksplisit user mengaktifkan insert sungguhan, DAN
   setelah ada cara nyata menguji cabang "ketemu" (butuh piutang yang
   BENAR-BENAR sudah tersinkron via `retailku_sync` di database dev).

## Catatan proses (feedback untuk sesi berikutnya)

- **Jangan simpulkan "gap struktural tidak bisa diselesaikan" tanpa
  menggali lebih dalam ke sisi server dulu** — riset awal
  `CONSIGNMENT_SETTLEMENT` sempat salah menyimpulkan butuh heuristik
  FIFO tebak-tebakan, padahal Retailku ternyata SUDAH menyimpan
  rincian per-transaksi (cuma di tabel lain, `LedgerEntryPayment`,
  bukan di jurnal). User yang meminta dicek ulang ("coba cek di sisi
  retailkunya, besar tidak cakupannya?") sebelum menerima kesimpulan
  pertama — pola ini KONSISTEN dengan feedback sesi-sesi sebelumnya
  (lihat handover 2026-09-28 sesi 3: "jangan anggap rencana hasil
  riset/agent sebagai final").
- **Field array baru butuh 2 percobaan** untuk `CONSIGNMENT_SETTLEMENT`
  — percobaan pertama salah asumsi (`LedgerEntry.journalEntryId`
  terisi, padahal SELALU `NULL` untuk kasus ini, journal aslinya lewat
  `sourceType`/`sourceId` polymorphic milik `LedgerEntry` itu sendiri)
  — verifikasi ke data nyata (bukan cuma `npx nest build` sukses)
  yang menangkap bug ini. **Pelajaran: build sukses ≠ logic benar untuk
  query dengan relasi tidak langsung/polymorphic — selalu verifikasi
  ke data nyata sebelum lapor selesai.**
- **Cache dev server bisa menyesatkan verifikasi visual** — preview
  UI sempat menampilkan status LAMA (skipReason sebelum perbaikan
  bug consignment) walau kode sudah benar, sampai user refresh manual.
  Kalau hasil visual tidak sesuai ekspektasi padahal kode & build
  sudah benar, curigai cache/hot-reload dulu sebelum mengasumsikan
  ada bug baru.
- User TIDAK ingin agen menjalankan `tauri dev`/restart server sendiri
  — pola ini konsisten dari sesi-sesi sebelumnya, user yang menjalankan
  dan paste hasil console/screenshot secara manual.

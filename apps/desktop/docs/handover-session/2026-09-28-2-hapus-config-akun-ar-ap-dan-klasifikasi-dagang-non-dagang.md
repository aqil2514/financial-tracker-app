# Handover — 2026-09-28 (sesi 2)

Lanjutan dari `2026-09-28-1-mapping-fund-transfer-dan-toggle-mengikuti-retailku.md`.
Sesi ini: (1) memperbaiki UX form transaksi native supaya akun `debt`
cuma bisa disentuh lewat transfer, (2) menghapus field `categoryId` dari
mapping AR_AP (tidak applicable), (3) **menghapus total** config akun
AR/AP lama di tab Konfigurasi beserta jalur insert-nya (disepakati
eksplisit, bukan disambungkan), (4) menemukan gap besar: piutang/utang
DAGANG vs NON-DAGANG punya pola kas yang beda drastis, (5) menambah
field `receivablePayableRole`/`receivablePayableKind`/`cashAccounts` di
server retail-multitenant + financial-app, (6) membangun helper
resolusi akun kas (`resolveArApCashAccounts`) TERISOLASI, belum
disambungkan ke sync, (7) update `docs/todos/plan/account-type.md`
soal `advance` diperluas jadi konsep dua arah. **BELUM ada jalur sync
AR/AP yang aktif sama sekali — itu FOKUS EKSPLISIT sesi berikutnya.**

## Ringkasan alur sesi

1. **UX form transaksi native — akun `debt` dipaksa lewat Transfer**
   (`use-transaction-form.ts`): pilih akun bertipe `debt` di field
   "Akun" (income/expense) otomatis paksa `type` ke `"transfer"`; ganti
   `type` menjauh dari transfer sementara akun terpilih masih `debt`
   otomatis kosongkan field akun. Kedua efek dijaga saling tidak
   menganulir lewat `previousTypeRef`. Latar belakang: `applyDebtTransaction`
   early-return kalau `type !== "transfer"` — sebelum perbaikan ini,
   user bisa pilih akun debt di income/expense, transaksi tersimpan
   "sukses" tapi TIDAK PERNAH tercatat sebagai piutang/utang (bug
   senyap, ditemukan lewat pertanyaan user soal UX form).

2. **`categoryId` dihapus dari mapping AR_AP** (`ArApMappingRowDraft`,
   schema, form, save payload, tooltip) — kategori cuma applicable utk
   `type: income/expense`, AR/AP SELALU `type: transfer` (dikonfirmasi
   `insertTransferTransaction` di `insert-ar-ap-transaction.ts` — SAAT
   ITU masih ada, sebelum dihapus poin 3 — tidak pernah menyimpan
   `category_id` sama sekali). Payload save tetap kirim `categoryId: null`
   eksplisit (kolom di skema tabel bersama masih ada, cuma dipaksa
   kosong utk AR_AP).

3. **HAPUS TOTAL config akun AR/AP lama di Konfigurasi** — permintaan
   eksplisit user ("Coba hapus dulu semua logic mapping akun beserta
   komponennya di sisi sync. Biarkan config ini fokusnya ke sync. Jadi
   mapping, diatur pada halaman mapping") setelah didemonstrasikan lewat
   query DB nyata bahwa akun kas AR/AP SELALU statis (1 akun untuk
   SEMUA transaksi, contoh nyata: `retailku_ar_ap_cash_account_id = 6`
   BRI dipakai bahkan utk pelunasan yang aslinya tunai — akan salah
   catat saldo). Dihapus:
   - Section `ArApCashAccountSection` ("Akun Kas untuk Utang Piutang")
     dan `DebtAccountsSection` ("Akun Utang Piutang") — file + komponen.
   - Field `arApCashAccountId`/`receivableDebtAccountId`/
     `payableDebtAccountId` dari `RetailkuCashflowSyncSettings`,
     `SyncCashflowInput`, `SyncAllInput`, dan semua interface/hook
     turunannya (`use-cashflow-sync-fields`, `use-sync-now`,
     `use-preview-sync`, `use-debt-accounts-draft` — file INI DIHAPUS
     total).
   - `insert-ar-ap-transaction.ts`, folder `ar-ap-plan-rows/`,
     `is-ar-ap-row-synced.ts` — DIHAPUS.
   - Loop insert AR/AP + `arApRows`/`arApInsertedCount`/
     `arApAccountNotConfigured` di `sync-cashflow.ts`/`types.ts` —
     DIHAPUS.
   - Tabel "Piutang/Utang" + statistiknya di dialog Preview Sync —
     DIHAPUS.
   - 3 row `settings` di `finance.dev.db` (`retailku_ar_ap_cash_account_id`,
     `retailku_receivable_debt_account_id`, `retailku_payable_debt_account_id`)
     — DIHAPUS permanen, diverifikasi lewat query WAL-inclusive.
   - `extract-ar-ap-rows.ts` TIDAK dihapus — tetap dipakai halaman
     Mapping (`use-load-ar-ap-mapping-keys.ts`).
   - Konfigurasi sekarang MURNI: Mode Sync, Periode Sync, Preview Data,
     tombol Sync Sekarang — tidak ada pengaturan akun apa pun.

4. **GAP BESAR ditemukan: piutang/utang DAGANG vs NON-DAGANG beda pola
   kas secara fundamental** (dipicu pertanyaan user "kalau piutang yang
   didapat dari dagang, jelas tidak ada perpindahan sesama uang ya?
   Karena yang berkurang adalah barang"):
   - **Dagang** (TRADE_RECEIVABLE, SUPPLIER_RECEIVABLE,
     ACCOUNTS_PAYABLE, CONSIGNMENT_PAYABLE) — PENCIPTAAN piutang/utang
     TIDAK melibatkan kas sama sekali (lawan jurnal: Penjualan/
     Pembelian/Persediaan), kas baru muncul saat PELUNASAN.
   - **Non-dagang** (OTHER_RECEIVABLE, OTHER_PAYABLE, via ledger manual
     — mis. "Minjem Kas") — kas terlibat SEJAK PENCIPTAAN (pinjaman =
     uang berpindah langsung).
   - **TAPI kenyataan lapangan TIDAK biner** (diverifikasi ke data nyata
     Warung Aqil, live query + docker db): ada kasus dagang+penciptaan
     yang TETAP ada kas (DP/uang muka sebagian dalam 1 nota penjualan
     — verified: `SL-260612-09`, piutang Rp3000 + kas Rp2000 dalam
     SATU entry jurnal yang sama, total penjualan Rp5000). Ada juga
     kasus dagang+pengurangan yang TIDAK ada kas (BUKAN pelunasan,
     tapi REVERSAL/koreksi entry atau RETUR barang — verified 2 entry
     berpasangan saling membalik, `SL-260529-08` & pasangannya).
   - **KESIMPULAN DESAIN**: jangan asumsikan kind×fase secara kaku.
     Cara benar: selalu cek `cashAccounts` PER TRANSAKSI INDIVIDUAL —
     kosong = tidak perlu resolusi kas, terisi = resolusikan apa pun
     kind/fase-nya.

5. **Server retail-multitenant diperluas** (`get-cfr-detail.helper.ts`,
   `get-cashflow-detail.ts` MCP tool) — 2 field baru per baris AR/AP:
   - `receivablePayableRole` — role mentah (`TRADE_RECEIVABLE`,
     `SUPPLIER_RECEIVABLE`, `ACCOUNTS_PAYABLE`, `CONSIGNMENT_PAYABLE`,
     `OTHER_RECEIVABLE`, `OTHER_PAYABLE`).
   - `receivablePayableKind` — turunan sederhana `"trade" | "non-trade" | null`
     (OTHER_* = non-trade, sisanya trade).
   - `cashAccounts` (field ini SEBENARNYA sudah ada dari sesi sebelum
     ini, TAPI belum pernah dideklarasikan tipenya/dipakai di
     financial-app — ditemukan saat baca ulang kode server) — array
     akun kas/bank pasangan dalam entry jurnal yang sama, `[]` kalau
     tidak ada (dagang murni), bisa >1 (split bill).
   - DIVERIFIKASI 2x: (a) query langsung via helper function + Docker
     psql sebelum restart server, (b) panggilan MCP tool ASLI
     (`get_cashflow_detail`) setelah user restart server — SEMUA field
     baru muncul benar di response nyata.

6. **Financial-app: tipe TS + `ArApRow` diperluas** —
   `RetailkuCashflowDetailRow` (MCP client) tambah `receivablePayableRole`/
   `receivablePayableKind`/`cashAccounts`. `ArApRow` (`extract-ar-ap-rows.ts`)
   tambah `sourceType`/`kind`/`cashAccounts`. `ArApMappingRowDraft` tambah
   `kind` (dibawa ke draft, DITAMPILKAN sbg badge "Dagang"/"Non-Dagang"
   di form + overview panel — biru utk trade, kuning utk non-trade).

7. **Helper `resolveArApCashAccounts` dibangun TERISOLASI** (file baru
   `resolve-ar-ap-cash-account.ts`, 7 unit test lulus) — TIDAK
   disambungkan ke sync/insert mana pun (keputusan eksplisit user:
   "Bangun helper resolusinya dulu... belum sambung ke sync/insert").
   Logic: tiap `cashAccounts[i].accountId` (akun kas Retailku)
   di-lookup ke `retailku_sync_field_mapping` PAKAI KEY GENERIC YANG
   SAMA dgn cashflow biasa (`detail:<accountId>:<sourceType>:<arah>`
   utk mode detail, `summary:<arah>:<accountId>` utk mode summary,
   arah dari tanda `cashAccounts[i].amount`) — BUKAN field/mapping baru
   di form AR_AP. Alasan: form Mapping AR_AP TIDAK PERLU field akun
   kas sama sekali — resolusi kas levelnya PER TRANSAKSI saat sync,
   reuse mapping generic yang user SUDAH isi utk akun kas biasa.

8. **`docs/todos/plan/account-type.md` diperbarui** — kandidat
   `account_type: advance` (uang muka) DIPERLUAS dari "spesifik uang
   muka pembelian ke supplier" jadi KONSEP UMUM dua arah (kita bayar
   duluan = prepaid expense, kita terima duluan = unearned revenue/
   customer deposit) — sama pola dgn `account_type: "debt"` yang sudah
   ada (satu tipe, dua arah). Dipicu pertanyaan user: "ini konteks
   umum kan? ... orang pasti pernah melakukan Preorder". Ditemukan dari
   kasus nyata `PURCHASE_ORDER` Retailku: jurnal PO cuma soal uang muka
   (akun role `PURCHASE_ADVANCE`, "Uang Muka Pembelian", KODE 1600 —
   BUKAN salah satu dari 6 role AR/AP), akun ini `isTrackedAsset: false`
   jadi TIDAK PERNAH lolos filter `get_cashflow_detail` sama sekali —
   cuma sisi kasnya (mis. Seabank) yang muncul, diklasifikasi generic
   biasa. `docs/reference/retailku-cashflow-row-classification.md`
   SUDAH final mendokumentasikan ini sejak sesi 27 Sept — TIDAK
   diketemukan sbg bug baru, cuma dipertegas semantiknya.

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **Insert AR/AP TIDAK ADA SAMA SEKALI di jalur sync** — beda dari sesi
  sebelumnya (yang statusnya "ada tapi DRY_RUN"), sekarang benar-benar
  tidak ada pemanggilan/logic apa pun terkait AR/AP di
  `sync-cashflow.ts`/`compute-cashflow-sync.ts`. `plan.arApRows` sudah
  TIDAK ADA lagi di `CashflowSyncPlan`.
- **Mapping AR_AP (halaman Mapping) TETAP AKTIF PENUH** dan MENYIMPAN
  SUNGGUHAN ke DB (verified: key `ar_ap:...:payable`/`ar_ap:...:receivable`
  utk Warung Aqil, `local_account_id=70` "Bisnis", `extra_fields:
  {"contactFollowSource":true}`) — TAPI mapping ini TIDAK BERPENGARUH
  ke sync apa pun karena TIDAK ADA jalur insert yang membacanya.
  `kind` (trade/non-trade) SUDAH tampil di UI-nya.
- **`resolveArApCashAccounts` SIAP PAKAI tapi BELUM DIPANGGIL** dari
  mana pun di luar test file-nya sendiri.
- **DUA KEPUTUSAN DESAIN BESAR BELUM DIJAWAB** (didiskusikan tapi
  sengaja dihentikan sebelum coding, akan dibahas sesi berikutnya):
  1. Baris AR/AP dengan `cashAccounts: []` (dagang murni, TIDAK ADA
     sisi kas) — skema `transactions` mengharuskan `type: transfer`
     SELALU punya `account_id` DAN `transfer_account_id` (2 sisi wajib).
     "Transaksi 1 sisi" secara struktural TIDAK VALID di skema
     sekarang. Kemungkinan solusi: baris `debts` dibuat TANPA baris
     `transactions` pendamping (`transaction_id: null`)? BELUM
     diputuskan, BELUM ada kode.
  2. Baris AR/AP dengan `cashAccounts` >1 entri (split bill/DP
     sebagian) — `applyDebtTransaction` (dipakai jalur native JUGA,
     bukan cuma Retailku) cuma terima 1 `accountId` per panggilan (1
     transfer = 1 pasangan akun). Split ke >1 akun kas berarti piutang
     itu sendiri perlu dipecah proporsional per cash account. BELUM
     diputuskan, BELUM ada kode.
- **`account_type: advance` (uang muka) MASIH RENCANA**, TIDAK ada
  migrasi/kode — cuma dokumen `account-type.md` yang diperbarui
  semantiknya sesi ini.
- Dev server (`tauri dev`) TETAP HIDUP sepanjang sesi (user verifikasi
  manual berkali-kali, TIDAK pernah diminta stop).

## Dokumen yang berubah/baru sesi ini

- `docs/todos/plan/account-type.md` — bagian "Uang Muka" diperluas
  jadi konsep dua arah.
- `docs/reference/retailku-cashflow-row-classification.md` — 1 kalimat
  ditambah di bagian `PURCHASE_ORDER`, menegaskan `advance` generik
  (TIDAK ada perubahan substansi klasifikasi).
- Migrasi baru: TIDAK ADA sesi ini (semua perubahan level kode
  TypeScript + 1 file server retail-multitenant, bukan skema SQLite).

## Keputusan yang SUDAH diambil sesi ini (jangan tanya ulang)

1. Akun `debt` di form transaksi native CUMA bisa disentuh lewat
   Transfer — auto-switch `type` + auto-clear akun, 2 arah saling
   dijaga tidak menganulir.
2. `categoryId` DIHAPUS dari mapping AR_AP total (bukan cuma UI) —
   tidak applicable, transaksi AR/AP SELALU transfer.
3. Config akun AR/AP lama (Konfigurasi) DIHAPUS TOTAL, BUKAN
   disambungkan ke mapping baru — keputusan eksplisit, bukan
   kompromi/tambal.
4. Klasifikasi dagang/non-dagang TIDAK BOLEH dipakai sbg aturan kaku
   utk sembunyikan/tampilkan field form — resolusi akun kas HARUS per
   transaksi individual via `cashAccounts`, bukan per kind/fase agregat.
5. Akun kas AR/AP di-resolve lewat MAPPING GENERIC YANG SUDAH ADA
   (key sama dgn cashflow biasa), BUKAN field/mapping baru khusus
   AR_AP — form Mapping AR_AP TETAP cuma: akun debt, kontak, judul,
   deskripsi (TIDAK bertambah field akun kas).
6. `account_type: advance` DIPERLUAS scope-nya jadi generik 2 arah
   (bukan spesifik "purchase advance") — nama tetap `advance`, BUKAN
   `purchase_advance` (sempat diusulkan, DIKOREKSI user).
7. Helper resolusi kas dibangun DULU secara terisolasi (dgn unit
   test), TIDAK langsung disambungkan ke sync/insert — supaya 2
   keputusan desain besar yg masih terbuka (baris tanpa kas, baris
   split) bisa dibahas terpisah tanpa helper-nya perlu ditulis ulang.

## Lanjut sesi berikutnya (EKSPLISIT: "jalur sync")

User eksplisit: **"itu nanti saja... kembali ke mapping"** lalu di
akhir sesi **"Next sesi kita akan lanjut ke sync"** — urutan yang
disarankan berdasar diskusi sesi ini:

1. **Putuskan 2 keputusan desain besar** (lihat "Status kode saat ini"
   di atas) SEBELUM mulai coding — terutama soal baris tanpa kas
   (`transactions` 2-sisi wajib vs kebutuhan baris 1-sisi) karena ini
   berpotensi ubah skema/`applyDebtTransaction` yang dipakai jalur
   NATIVE juga, bukan cuma Retailku.
2. **Bangun ulang `ar-ap-plan-rows/`** (baca akun debt dari
   `retailku_sync_field_mapping` key `ar_ap:<accountId>:<direction>`,
   BUKAN dari config lama yang sudah dihapus) + sambungkan
   `resolveArApCashAccounts` yang sudah siap.
3. **Bangun ulang `insertArApTransaction`** — terima resolusi akun kas
   PER TRANSAKSI (bukan parameter statis seperti desain lama yang
   dihapus), handle kasus `cashAccounts: []` dan `cashAccounts.length > 1`
   sesuai keputusan poin 1.
4. Skip reason baru dibutuhkan: akun debt unmapped (`ar_ap:...` belum
   ada di mapping) DAN akun kas unmapped (salah satu `cashAccounts[i]`
   belum ada di mapping generic) — DUA kondisi independen, baris bisa
   gagal salah satu atau keduanya.
5. Tetap `DRY_RUN` dulu sebelum insert sungguhan diaktifkan — pola
   sama seperti semua fitur sync baru sebelumnya.

## Catatan proses (feedback untuk sesi berikutnya)

- **User eksplisit minta HAPUS JSDoc panjang** di tengah sesi ini
  ("Saya merasa JSDocs justru tidak membantu saya sama sekali, malah
  membuat kotor. Bisa hapus saja jsdocsnya?") — disimpan ke memory
  (`feedback_no_jsdoc.md`). BERLAKU REPO-WIDE, bukan cuma file yang
  sedang dibuka saat itu. **Sesi berikutnya: JANGAN tulis blok JSDoc
  multi-paragraf lagi** (gaya lama di codebase ini — narasi
  "BEDA dari X", "lihat Y", riwayat keputusan panjang di komentar
  inline) — kalau perlu penjelasan sepanjang itu, taruh di sini
  (handover) atau `docs/`, bukan inline code. Default: TANPA komentar,
  1 baris kalau genuinely non-obvious.
- User SANGAT AKTIF menantang asumsi dengan pertanyaan Socratic
  sebelum menyetujui desain — pola sesi ini: setiap kali diberi
  kesimpulan, user tanya balik skenario spesifik ("kalau bayar
  tunai gimana?", "kalau split bill gimana?", "PO ada DP, itu di mana
  penanganannya?") yang MEMBONGKAR asumsi yang sudah dianggap final.
  MINIMAL 3 putaran signifikan terjadi (desain key AR/AP per-pihak
  DIBATALKAN, klaim "trade+penciptaan selalu tanpa kas" DIKOREKSI jadi
  "per-transaksi", scope "advance" DIPERLUAS dari sempit ke umum).
  **Pola: JANGAN anggap kesimpulan pertama final — verifikasi ke data
  nyata SEBELUM mengklaim aturan umum, karena user akan menemukan
  counter-example lewat pertanyaan yang tampak sederhana.**
- User secara konsisten memisahkan MAPPING dari SYNC sebagai 2 scope
  berbeda sepanjang sesi ini (sama seperti sesi 28 Sept sesi 1) —
  berkali-kali menghentikan/mengarahkan ulang saat asisten mulai
  merancang sesuatu yang menyentuh sync padahal user sedang bicara
  mapping (atau sebaliknya). **Pola berlanjut: SELALU eksplisit
  tanyakan/nyatakan sisi mana (mapping vs sync) sebelum menulis kode,
  JANGAN asumsikan "sudah dekat, sekalian saja".**
- User minta verifikasi lintas-repo (retail-multitenant) via Docker
  psql query LANGSUNG + panggilan MCP tool ASLI (bukan cuma baca kode)
  sebelum percaya field baru benar-benar berfungsi — dilakukan 2x
  sesi ini (sekali sebelum restart server via helper function
  langsung, sekali sesudah restart via tool MCP sungguhan). Konsisten
  dengan `docs/rules/checking-dev-database.md`.

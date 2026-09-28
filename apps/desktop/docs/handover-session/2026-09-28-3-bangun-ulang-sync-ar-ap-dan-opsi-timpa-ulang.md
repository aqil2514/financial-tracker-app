# Handover — 2026-09-28 (sesi 3)

Lanjutan dari `2026-09-28-2-hapus-config-akun-ar-ap-dan-klasifikasi-dagang-non-dagang.md`.
Sesi ini: (1) **membangun ulang jalur sync AR/AP dari nol**, scope
disempitkan lewat serangkaian klarifikasi jadi MURNI penciptaan
piutang/utang baru (bukan pelunasan, bukan representasi kas dari DP),
(2) menambah opsi `arApExistingMode` ("Lewati"/"Timpa Ulang", default
Lewati) di Konfigurasi untuk baris AR/AP yang sudah pernah tersinkron,
(3) **verifikasi end-to-end penuh** — migrasi jalan, plan-rows benar
terhadap data Warung Aqil nyata, log DRY_RUN sesuai, skema DB
dikonfirmasi via query langsung.

## Verifikasi hasil kerja sesi ini (dilakukan, bukan diasumsikan)

1. **`npx tsc --noEmit`** — bersih, 0 error, di seluruh proyek (2x
   dijalankan: sekali setelah bangun-ulang inti, sekali lagi setelah
   fitur timpa-ulang — keduanya bersih setelah perbaikan caller yang
   kena breaking change tipe `SyncCashflowInput`/`computeCashflowSync`).
2. **`npx vitest run`** — 121/121 test lulus (naik dari 117 baseline —
   4 baru: `insert-ar-ap-transaction.test.ts` ×5,
   `ar-ap-plan-rows/index.test.ts` ×7, termasuk kasus `overwrite`).
3. **`cargo check`** (`src-tauri`) — sukses, migrasi baru
   (`0025_debts_source_ref.sql`) terdaftar benar di `migrations.rs`
   (INGAT: migrasi Tauri SQL HARUS didaftarkan eksplisit di situ,
   TIDAK auto-discover dari nama file — sempat lupa sebentar sebelum
   dicek ulang).
4. **DRY_RUN nyata via `tauri dev` + data Warung Aqil** (dilakukan
   USER langsung di app, bukan simulasi) — hasil dari console browser
   asli, rentang 2026-09-20 s/d 2026-09-26:
   - Cashflow biasa: 21 baris, semua `already-synced` (rentang ini
     memang sudah pernah disync sebelumnya, bukan bug).
   - AR/AP: 3 baris ditemukan —
     - `amount: -2000` ("Nenek Petok", piutang) → `skipReason:
       "negative-amount-not-supported"`, TIDAK insert. BENAR.
     - `amount: 1500` & `amount: 6000` ("Mba-mba Kado Kuning", utang
       Hutang ke Penitip) → `willInsert: true`,
       `debtLocalAccountId: 70`, `contactFollowSource: true`,
       `contactId: null` (BENAR — kontak di-resolve dari
       `partyName` saat insert, bukan dari mapping statis).
   - Log `[DRY_RUN] ar-ap row` muncul TEPAT 2× (cuma untuk baris
     `willInsert: true`), field sesuai plan row.
5. **Query langsung ke `finance.dev.db`** (copy + WAL/SHM ke
   scratchpad, ikut `docs/rules/checking-dev-database.md`):
   - `_sqlx_migrations`: versi 25 (`debts_source_ref`) `success=1`.
   - `PRAGMA table_info(debts)`: kolom `source` (`TEXT NOT NULL
     DEFAULT 'manual'`) dan `source_ref` (`TEXT`, nullable) ADA,
     posisi kolom 10-11 sesuai definisi migrasi.
   - Index `idx_debts_source_ref`: UNIQUE, partial
     `WHERE source_ref IS NOT NULL` — sesuai desain.
   - `debts` total 15 baris, **0 baris `source='retailku_sync'`** —
     mengonfirmasi DRY_RUN benar-benar tidak insert apa pun.
   - `settings` — key `retailku_ar_ap_existing_mode` (fitur timpa
     ulang) belum pernah tersimpan (wajar, baru ditambah sesi ini,
     fallback default `'skip'` di kode).

**Kesimpulan verifikasi: fitur bekerja sesuai spesifikasi, teruji
terhadap data produksi Warung Aqil (bukan cuma unit test/type check),
dan tetap aman — TIDAK ADA baris `debts`/`transactions` baru
tersimpan sungguhan sepanjang sesi ini (`DRY_RUN = true` konsisten).**

## Ringkasan alur sesi

### 1. Bangun ulang jalur sync AR/AP — proses klarifikasi sampai final

Sesi lalu (sesi 2) sudah menghapus total jalur lama dan menyiapkan 2
keputusan desain besar untuk dibahas sesi ini ("baris tanpa kas" dan
"split bill"). User membahas keduanya lewat pertanyaan Socratic
berulang, dan hasil akhirnya **jauh lebih sempit** dari rencana awal:

1. Poin "baris tanpa kas" (`cashAccounts: []`) — dijawab: `debts`
   dibuat langsung dengan `transaction_id: NULL`, TIDAK PERLU migrasi
   (skema `0012_debts.sql` sudah nullable untuk kolom itu).
2. Poin "split bill" (`cashAccounts` >1 entri) — awalnya disepakati
   pola "1 debts + N debt_payments", TAPI setelah didalami lewat
   pertanyaan "kalau split bill di sini akan dihitung 1 akun lawan
   debtsnya?", ternyata perlu dipisah jadi 2 sub-kasus berbeda:
   - Kasus **DP** (row.amount != 0, ada sisa piutang net) — SETELAH
     klarifikasi lebih lanjut soal makna `row.amount` vs
     `cashAccounts` (row.amount = piutang MURNI dari baris jurnal
     piutang itu sendiri, BUKAN termasuk bagian kas — dikonfirmasi ke
     komentar `get-cashflow-detail.ts` baris 61-73), diputuskan:
     **`cashAccounts` diabaikan TOTAL** — TIDAK jadi `debt_payments`
     sama sekali. `debts.amount = row.amount` apa adanya.
   - Kasus **lunas total split** (row.amount = 0, cashAccounts >1) —
     awalnya dipikirkan perlu direpresentasikan (debts+debt_payments
     sekaligus, status paid), TAPI diputuskan **di luar scope juga**
     — konsisten dgn keputusan DP: `cashAccounts` diabaikan total,
     `amount === 0` cukup di-skip.
3. Representasi kas dari DP itu sendiri (uang yg diterima duluan
   perlu masuk saldo akun kas) — ditanya eksplisit, dijawab: **di
   luar scope sesi ini**, gap diketahui utk sesi berikutnya.
   `resolveArApCashAccounts` (helper sesi lalu, 7 test) TETAP SIAP
   PAKAI tapi TIDAK disambungkan.
4. Baris `row.amount < 0` (pelunasan ATAU reversal, tidak bisa
   dibedakan otomatis) — ditanya eksplisit, dijawab: **di luar scope
   sesi ini juga**, skip dgn reason eksplisit
   `negative-amount-not-supported`.

**Hasil akhir: scope sesi ini MURNI "catat piutang/utang baru
(amount > 0) sebagai baris `debts`, transaction_id selalu NULL, abaikan
cashAccounts sepenuhnya".** Pelunasan, reversal, representasi kas dari
DP, dan `account_type: advance` SEMUA masih rencana/gap diketahui.

### 2. Idempotency — migrasi `0025_debts_source_ref.sql`

Idempotency lama (`is-ar-ap-row-synced.ts`, dihapus sesi 2) cek
`transactions.source_ref` — TIDAK berlaku lagi karena baris AR/AP baru
bisa `transaction_id: NULL`. Ditanya eksplisit ke user, dijawab:
**migrasi baru**, kolom `source`/`source_ref` di `debts`, mengikuti
pola PERSIS `transactions.source`/`source_ref` (`0017_transaction_source.sql`)
termasuk UNIQUE partial index. Diverifikasi jalan (lihat bagian
Verifikasi di atas).

### 3. Implementasi — file baru & diubah

**Baru:**
- `src-tauri/migrations/0025_debts_source_ref.sql` (+ didaftarkan di
  `src-tauri/src/migrations.rs`, version 25).
- `helpers/is-ar-ap-row-synced.ts` — diubah nama fungsi jadi
  `findSyncedArApDebtId` (return `id | null`, BUKAN cuma boolean —
  supaya mode "overwrite" tahu baris mana yang di-UPDATE).
- `helpers/ar-ap-plan-rows/` — `index.ts` (orkestrator
  `buildArApPlanRows`) + `base-plan-row.ts` (helper bersama, hindari
  duplikasi field) + 6 file kategori hasil: `zero-amount`,
  `negative-amount`, `unmapped-debt-account`, `already-synced`,
  `insertable`, `updatable` (baru, utk mode overwrite).
- `helpers/insert-ar-ap-transaction.ts` — INSERT (baris baru) ATAU
  UPDATE (`row.willUpdate`, mode overwrite) `debts`, TIDAK PERNAH
  menyentuh `cashAccounts`.
- 2 file test baru + kasus overwrite ditambahkan setelahnya.

**Diubah:**
- `cashflow/types.ts` — `ArApSyncPlanRow` (+ `willUpdate`,
  `existingDebtId`), `ArApSkipReason`, `ArApSyncPlan`, extend
  `CashflowSyncPlan`/`SyncCashflowResult`/`SyncCashflowInput`
  (+ `arApExistingMode`)/`RetailkuSyncFieldMappingRow` (+ `extraFields`).
- `helpers/load-sync-inputs/load-field-mapping.ts` — ikut ambil+parse
  `extra_fields` (dibutuhkan utk `contactId`/`contactFollowSource`
  AR/AP, sebelumnya cuma di-select `use-field-mapping.ts` sisi UI).
- `compute-cashflow-sync.ts` — sambungkan `buildArApPlanRows` paralel
  dgn `buildPlanRows` yg sudah ada.
- `sync-cashflow.ts` — loop insert/update AR/AP (DRY_RUN), pisahkan
  `arApInsertedSourceRefs` (insert baru) dari `arApUpdatedCount`
  (update) — PENTING utk rollback (lihat poin berikut).
- `sync-all.ts` — **bug diperbaiki**: `rollbackManually` dulu
  menghapus `debts` lewat subquery via `transactions.source_ref`
  (`transaction_id IN (SELECT ...)`) — TIDAK menjangkau baris AR/AP
  baru yg `transaction_id: NULL`. Diganti `DELETE FROM debts WHERE
  source_ref IN (...)` langsung. Juga: baris `willUpdate` SENGAJA
  TIDAK dimasukkan ke daftar rollback (itu bukan insert baru — kalau
  ikut di-DELETE saat rollback, akan menghapus data yang sudah ada
  SEBELUM sync ini berjalan, bukan cuma membatalkan perubahan sesi
  ini).
- `use-retailku-cashflow-sync-settings.ts` — tambah field
  `arApExistingMode: "skip" | "overwrite"` (key DB
  `retailku_ar_ap_existing_mode`), `mutationFn` digeneralisasi supaya
  bisa simpan field mana pun (sebelumnya hardcode `syncMode` saja).
- Rantai penyaluran `arApExistingMode` dari UI Konfigurasi sampai ke
  `buildArApPlanRows`: `use-cashflow-sync-fields.ts` →
  `use-cashflow-config.ts` → `use-sync-now.ts`/`use-preview-sync.ts` →
  `sync-all.ts` → `sync-cashflow.ts` → `compute-cashflow-sync.ts`.
- `config/contents/ar-ap-existing-mode-section.tsx` (baru) — UI
  toggle "Lewati"/"Timpa ulang", pola PERSIS `sync-mode-section.tsx`
  (draft+tombol Simpan sendiri), ditaruh di `config/contents/index.tsx`
  setelah `SyncModeSection`.
- `use-sync-now.ts` — toast baru: `arApUnmappedDebtKeys` (warning) dan
  `arApUpdatedCount` (info, muncul kalau mode overwrite menghasilkan
  update).

### 4. Opsi "Timpa Ulang" — model final

- Default: **"Lewati"** (`skip`) — baris yang `source_ref`-nya sudah
  ada di `debts` di-skip apa adanya, `skipReason: "already-synced"`,
  SAMA seperti perilaku sebelum fitur ini ada.
- **"Timpa Ulang"** (`overwrite`) — baris yang sudah pernah sync
  di-**UPDATE** (`debts.id` TETAP SAMA, bukan DELETE+INSERT — dipilih
  eksplisit oleh user karena `debts.id` mungkin direferensikan dari
  tempat lain di masa depan, mis. `debt_payments`, jadi ganti id
  adalah risiko). Field yang di-UPDATE: `type`, `contact_id`,
  `amount`, `account_id`, `date` — `source`/`source_ref`/`status`/
  `created_at` TIDAK disentuh.
- Baris yang BELUM pernah sync tetap insert biasa apa pun mode-nya
  (`overwrite` cuma relevan kalau `existingDebtId` ditemukan).

## Status kode saat ini (PENTING, baca sebelum lanjut apa pun)

- **Masih `DRY_RUN = true`** di `sync-cashflow.ts` — SAMA seperti sesi
  2, insert/update sungguhan BELUM diaktifkan. Diverifikasi via query
  DB langsung (0 baris `debts.source='retailku_sync'`).
- **Scope AR/AP MURNI penciptaan** (`amount > 0`) — `amount <= 0` dan
  `cashAccounts` (apa pun isinya) TIDAK diproses sama sekali di jalur
  insert, cuma dibawa di `ArApRow`/plan row utk visibility/debug.
- **`resolveArApCashAccounts`** (sesi 2, 7 test) TETAP TIDAK
  disambungkan — helper siap pakai kalau gap "representasi kas dari
  DP" mulai digarap.
- **Opsi Timpa Ulang SIAP PAKAI** (UI + logic + test), default aman
  (Lewati) — user BELUM pernah menyimpan preferensi ini di DB
  (`settings` key belum ada baris, fallback default di kode).
- **Preview Sync dialog** (`preview-sync-section.tsx`) — CUMA
  menampilkan cashflow biasa (`result.cashflow.rows`), TIDAK ada tabel
  AR/AP di situ (belum dibangun ulang sejak dihapus sesi 2). Field
  `arApExistingMode` SUDAH disalurkan ke `computeCashflowSync` dari
  preview juga (`preview-sync-section.tsx` mengirim
  `fields.arApExistingMode.value`) supaya plan yang dihitung konsisten
  dgn mode yg dipilih, TAPI hasilnya belum ditampilkan di UI preview.

## Gap diketahui untuk sesi berikutnya (BUKAN lupa, sengaja ditinggalkan)

1. **Pelunasan/reversal** (`row.amount < 0`) — skip eksplisit, belum
   ada logic FIFO/settlement/pembedaan reversal vs pelunasan asli.
2. **Representasi kas dari DP/split payment** (`cashAccounts`) — sama
   sekali tidak menghasilkan insert apa pun sekarang (bukan cuma
   AR/AP-nya, bagian kasnya juga "hilang" secara pencatatan). Perlu
   didesain terpisah — kemungkinan sbg baris cashflow biasa yg
   terpisah dari `debts`, TAPI ini belum dibahas sama sekali.
3. **`account_type: advance`** — masih rencana dokumen
   (`docs/todos/plan/account-type.md`), tidak ada kode/migrasi.
4. **Tabel preview AR/AP** di dialog Preview Sync — belum dibangun
   ulang, cuma cashflow biasa yang tampil.
5. **DRY_RUN belum dinonaktifkan** — semua di atas baru actionable
   SETELAH keputusan eksplisit user utk mengaktifkan insert sungguhan
   (poin 5 rencana sesi 2, masih berlaku: "Tetap DRY_RUN dulu sebelum
   insert sungguhan diaktifkan").

## Catatan proses (feedback untuk sesi berikutnya)

- **Pola sesi 2 BERLANJUT KUAT di sesi ini**: user MINIMAL 3× menolak
  menerima kesimpulan pertama dari agen (lewat proses plan-mode
  eksplisit) dan mengoreksi lewat pertanyaan balik — paling signifikan:
  scope "split bill" yang di rencana AWAL (hasil Plan agent) berupa
  "1 debts + N debt_payments" SEPENUHNYA DIBATALKAN setelah didalami
  jadi "cashAccounts diabaikan total". **Pelajaran: jangan anggap
  rencana hasil riset/agent sebagai final SEBELUM dikonfirmasi
  eksplisit ke user tiap titik keputusan yang ambigu** — plan-mode
  yang dipakai sesi ini (EnterPlanMode → riset → tulis plan →
  ExitPlanMode) sudah tepat, TAPI klarifikasi lanjutan MASIH muncul
  SETELAH plan disetujui (poin makna `row.amount` vs `cashAccounts`
  ternyata masih ambigu meski sudah "diverifikasi" via git
  archaeology) — verifikasi ke KODE tidak selalu cukup, kadang perlu
  ditanya LANGSUNG walau sudah merasa yakin.
- **User eksplisit minta verifikasi END-TO-END, bukan cuma
  test/tsc** — sempat ditanya "verifikasinya bagaimana?" setelah
  laporan "selesai" yang cuma berbasis unit test+type check. Lalu user
  SENDIRI yang menjalankan `tauri dev`+sync manual dan share hasil
  console asli (bukan diminta menjalankan command shell sendiri oleh
  asisten — 2x permintaan `tasklist`/cek proses DITOLAK eksplisit
  dengan alasan "saya ingin verifikasi manual" / "saya akan test
  sendiri end to end"). **Pola: untuk fitur yang MENULIS data
  (migrasi, sync, mutation), tsc+test TIDAK CUKUP dilaporkan sebagai
  "selesai" — harus eksplisit jalankan verifikasi end-to-end (app
  nyata + query DB), dan kalau user ingin menjalankannya SENDIRI,
  jangan memaksa pakai tool Bash sendiri untuk cek proses/env —
  cukup kasih instruksi, atau tunggu hasil yang di-paste user.**
  Konsisten dgn `docs/rules/checking-dev-database.md` yang sudah ada.
- **User lanjut menegaskan preferensi TANPA JSDoc panjang** (dari
  memory `feedback_no_jsdoc.md`, sesi 2) — semua file baru sesi ini
  konsisten pakai komentar 1 baris kalau perlu, TIDAK ada blok
  JSDoc/narasi panjang.
- **Migrasi Tauri SQL HARUS didaftarkan eksplisit** di
  `src-tauri/src/migrations.rs` (`include_str!` + entry `Migration{}`)
  — TIDAK auto-discover dari nama file `NNNN_*.sql`. Sempat nyaris
  kelewatan sebelum verifikasi (untung ketangkap sebelum lapor
  "selesai" ke user) — **checklist utk migrasi baru berikutnya: SELALU
  cek `migrations.rs` ikut diupdate, bukan cuma file `.sql`-nya.**

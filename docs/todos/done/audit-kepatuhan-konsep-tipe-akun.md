# Audit: Kepatuhan Kode Terhadap Konsep Tipe Akun

> **Status: SELESAI** — 6 dari 7 pertanyaan terbuka DIEKSEKUSI
> 2026-10-03 (sesi lanjutan, sama hari sebagai audit ini, commit
> `572ff59`) — lihat "Keputusan & eksekusi" di bagian penutup. Dipindah
> ke `done/` karena itu.
>
> Pertanyaan #2 (sync Retailku) SENGAJA di-skip, dianggap lebih dalam
> dari perkiraan awal — **dipisah jadi dokumen tersendiri**, starting
> point sesi audit integrasi Retailku berikutnya:
> [apps/desktop/docs/todos/plan/retailku-sync-account-type-gap.md](../../../apps/desktop/docs/todos/plan/retailku-sync-account-type-gap.md).
>
> Isi temuan asli (di bawah) DIPERTAHANKAN apa adanya sebagai jejak
> histori — status terkini ditambahkan sebagai anotasi, tidak
> menghapus narasi audit awal.
>
> Dokumen ini hasil audit lintas `apps/desktop`, `apps/worker`,
> `apps/mcp-server` terhadap
> [docs/concept/konsep-tipe-akun.md](../../concept/konsep-tipe-akun.md),
> dilakukan 2026-10-03 setelah dokumen konsep itu dirumuskan.
>
> Beberapa temuan di sini (terutama "mode direct") lahir SEBELUM
> dokumen konsep ada — sesuai disclaimer di dokumen konsep, ini bukan
> berarti kodenya ditulis asal, tapi menunjukkan kenapa aturan "diskusi
> dulu sebelum implementasi" penting dijaga ke depan.

## Ringkasan

| # | Prinsip | Status audit | Status solusi |
|---|---|---|---|
| 1 | Akun sebagai tumpuan semua data | **Menyimpang** — beberapa jalur | ✅ #1.1 & #1.3 beres · ⏸️ #1.2 (Retailku) ditunda |
| 2 | Satu akun satu tipe | Belum menyimpang langsung, tapi ada asumsi biner rapuh | ✅ Beres — `classifyAccountPair` + fail-loud |
| 3 | Tipe permanen, terkunci setelah dipakai | **Belum diimplementasikan sama sekali** | ✅ Beres — guard Worker + UX desktop |
| 4 | Laporan apa adanya (tanpa klasifikasi kekayaan) | Sudah sesuai, tidak ada temuan | — (tidak perlu solusi) |
| 5 | Logic per-tipe tersebar (bukan pelanggaran, tapi peta risiko) | 20+ lokasi teridentifikasi | ✅ Beres — disentralisasi per-app |
| 6 | Konsistensi desktop vs Worker/MCP | **Tidak paralel** — mode direct cuma ada di desktop | ✅ Beres — endpoint + tool MCP baru |
| 7 | Skema SQL vs kode TS | Konsisten, tidak ada kontradiksi | — (tidak perlu solusi) |

---

## 1. Akun sebagai tumpuan semua data — MENYIMPANG

### 1.1 Fitur "mode direct" (dibangun sesi ini, SEBELUM dokumen konsep ada)

Piutang/utang bisa dicatat tanpa transaksi apa pun, `debts.account_id`
dan `transaction_id` sengaja NULL sejak INSERT pertama (bukan akibat
penghapusan akun/transaksi):

- `apps/desktop/src/shared/debts/new-debt-form/schema.ts` — field
  `record_mode: z.enum(["transfer", "direct"])`, validasi `.refine()`
  cuma mewajibkan `cash_account_id`/`debt_account_id` saat
  `record_mode === "transfer"`.
- `apps/desktop/src/shared/debts/new-debt-form/use-create-debt.ts` —
  cabang `record_mode === "direct"`: `INSERT INTO debts (..., account_id,
  transaction_id, ...) VALUES (..., NULL, NULL, ...)`.
- `apps/desktop/src/shared/debts/new-debt-form/new-debt-form.tsx` —
  toggle UI "Cara Mencatat" dengan opsi "Langsung (tanpa transaksi)".
- `apps/desktop/src/shared/debts/pay-debt-form/schema.ts` +
  `use-pay-debt.ts` — mode `settlement_mode === "non_cash"`: `INSERT
  INTO debt_payments (..., account_id, transaction_id, ...) VALUES
  (..., NULL, NULL, ...)`.
- `apps/desktop/src/shared/debts/pay-debt-form/use-pay-debt.ts` —
  cabang `debt.account_id == null`: pelunasan dengan uang tetap buat
  transaksi income/expense, tapi `debt_payments` diisi LANGSUNG (bukan
  lewat `applyDebtTransaction`/FIFO).

**UI tidak menandai piutang jenis ini secara eksplisit** — cuma
tampil strip (`—`) di kolom "Akun", visual sama persis dengan kolom
kosong biasa, tidak ada badge/label pembeda:
- `apps/desktop/src/features/debts/debt-list-table.tsx:57` —
  `{debt.account_name ?? "—"}`.
- `apps/desktop/src/features/debts-summary/content/card/detail/debt-row.tsx:29,68` —
  pola identik berulang di detail kontak & daftar cicilan.

### 1.2 Sync Retailku SUDAH LEBIH DULU membuat debts tanpa account_id (ditemukan baru, independen dari "mode direct")

Ini **bukan** akibat perubahan sesi ini — sudah ada sejak fitur sync
Retailku dibangun:

- `apps/desktop/src/features/retailku/shared/sync/cashflow/helpers/insert-ar-ap-transaction.ts` —
  SELALU insert `debts` dengan `transaction_id: NULL` (piutang/utang
  dagang murni tanpa sisi kas), `account_id` dari hasil mapping yang
  bertipe `string | null`.
- `apps/desktop/src/features/retailku/shared/sync/cashflow/helpers/insert-ar-ap-payment.ts`
  dan `insert-ar-ap-payments-batch.ts` — `debt_payments.account_id`
  bisa NULL "kalau akun kas belum dipetakan atau split ke >1 akun
  kas" (komentar eksplisit di kode).
- `apps/desktop/src-tauri/migrations/0025_debts_source_ref.sql` —
  komentar migrasi MENGONFIRMASI ini sudah jadi desain sadar: "baris
  `debts` hasil sync AR/AP sekarang bisa `transaction_id: NULL`
  (piutang/utang dagang murni tanpa sisi kas)".

### 1.3 Celah di MCP: `create_transaction` tidak mewajibkan `accountId`

- `apps/mcp-server/src/app/api/mcp/route.ts` — tool `create_transaction`
  punya `accountId: z.string().optional()`, BEDA dari form desktop yang
  mewajibkan `account_id` lewat Zod (`z.string().min(1, "Akun wajib
  dipilih")`).
- `apps/worker/src/modules/transactions/service.ts` (`createTransactionRow`)
  menerima `payload.accountId ?? null` tanpa validasi "wajib ada" untuk
  tipe income/expense — cuma ada guard `violatesDebtAccountRule` yang
  cek *tipe* akun KALAU `accountId` ada, bukan guard "harus ada".
- `apps/worker/src/modules/transactions/schema.ts` (`isPushTransactionPayload`) —
  tidak mensyaratkan `accountId` wajib sama sekali.

**Implikasi**: lewat MCP (misal dipanggil Claude dari HP), transaksi
income/expense bisa tercatat TANPA akun sama sekali — celah yang tidak
ada padanannya di form desktop.

---

## 2. Satu akun satu tipe — asumsi biner rapuh (belum menyimpang langsung)

Tidak ada akun yang benar-benar ber-tipe ganda. Tapi banyak logic
dibangun dengan asumsi HANYA ada 2 tipe (`cash`/`debt`), berisiko
silent-wrong begitu tipe ketiga (`investment`, dst) ditambahkan:

- `apps/desktop/src/features/transactions/form/add-edit/hooks/use-transaction-form.ts:54-55` —
  `sourceIsDebt`/`destinationIsDebt` memperlakukan "bukan debt" sebagai
  sinonim "cash". Akun bertipe `investment`/`valas` yang dipilih di
  field transaksi biasa TIDAK akan dideteksi sebagai kasus istimewa.
- `apps/desktop/src/shared/debts/apply-debt-transaction.ts` (dan versi
  Worker di `apps/worker/src/modules/debts/service.ts`) — kondisi
  `sourceIsDebt === destinationIsDebt` dipakai sebagai syarat "no-op,
  dianggap kas-ke-kas". Transfer `cash → investment` akan lolos
  sebagai "bukan urusan debt" tanpa logic investment yang semestinya.
- `apps/worker/src/modules/transactions/service.ts` (`violatesDebtAccountRule`) —
  cuma cek `account_type === "debt"`, tidak ada pertimbangan tipe lain
  yang mungkin juga butuh pembatasan serupa (mis. `investment` idealnya
  juga tidak boleh langsung kena income/expense tanpa representasi
  transaksi pasar).

---

## 3. Tipe permanen, terkunci setelah dipakai — BELUM DIIMPLEMENTASIKAN SAMA SEKALI

Dikonfirmasi: **tidak ada guard di lapisan manapun** (desktop, worker,
MCP) yang mencegah `account_type` diubah pada akun yang sudah punya
transaksi:

- `apps/desktop/src/features/accounts/form/use-update-account.ts` —
  `UPDATE accounts SET ..., account_type = $6, ...` langsung dari form,
  tanpa cek riwayat transaksi.
- `apps/desktop/src/features/accounts/form/account-form.tsx` — field
  `account_type` dirender `FormFieldSelect` biasa, tidak pernah
  di-disable, dipakai sama persis utk create maupun update.
- `apps/desktop/src/features/accounts/form/account.schema.ts` —
  `account_type: z.enum(["cash", "debt"])` tanpa `superRefine` terkait
  status pemakaian akun.
- `apps/worker/src/modules/accounts/service.ts` (`upsertAccount`,
  cabang update) — `UPDATE accounts SET ..., account_type = ?7, ...`,
  dipanggil juga dari endpoint yang di-expose lewat MCP tool
  `update_account` — tanpa pengecekan jumlah transaksi terkait akun.
- `apps/desktop/src/shared/cloud-sync/pull-sync.ts` — pull cloud sync
  (`ON CONFLICT DO UPDATE SET ..., account_type = excluded.account_type`,
  berbasis LWW `updated_at`) ikut menerapkan perubahan `account_type`
  dari cloud tanpa guard tambahan di sisi PC.

Ini gap MURNI — bukan bug di satu lokasi, tapi aturan di
`konsep-tipe-akun.md` ("Mengubah tipe akun yang salah pilih di awal")
memang belum pernah diterjemahkan jadi kode di mana pun.

---

## 4. Laporan apa adanya — SUDAH SESUAI, tidak ada temuan

- `apps/desktop/src/features/dashboard/content/total-balance/index.tsx` —
  `data?.reduce((sum, row) => sum + row.balance, 0)` menjumlah SEMUA
  akun tanpa filter tipe apa pun. Konsisten dengan prinsip "laporan
  menampilkan angka apa adanya, tanpa klasifikasi kekayaan".
- Tidak ditemukan tempat lain (MCP `get_debt_summary`,
  `get_account_balances`, dsb.) yang secara aktif meng-exclude tipe
  akun tertentu dari agregasi total.

---

## 5. Logic per-tipe tersebar — peta lokasi (bukan pelanggaran, tapi peta risiko utk tipe baru)

### 5.1 Perbandingan `account_type === "cash"` / `"debt"` (desktop)

- `shared/debts/pay-debt-form/pay-debt-form.tsx`
- `shared/debts/new-debt-form/new-debt-form.tsx` (2 lokasi)
- `features/transactions/form/add-edit/hooks/use-transaction-form.ts` (2 lokasi)
- `features/retailku/config/context/hooks/use-sync-prerequisites.ts` (2 lokasi)
- `features/retailku/mapping/form/fund-transfer/use-fund-transfer-mapping-form.ts`
- `features/retailku/mapping/context/hooks/use-resources.ts` (2 lokasi)

### 5.2 Perbandingan di Worker

- `apps/worker/src/modules/transactions/service.ts` (`violatesDebtAccountRule`)
- `apps/worker/src/modules/debts/service.ts` (beberapa lokasi, `sourceType`/`destinationType`)

### 5.3 Union type hardcoded `"cash" | "debt"` (definisi tipe, perlu diedit tiap tipe baru)

- `apps/desktop/src/lib/db.ts`
- `apps/desktop/src/shared/cloud-sync/worker-client.ts` (2 lokasi)
- `apps/desktop/src/shared/cloud-sync/push-row.ts`
- `apps/worker/src/modules/accounts/schema.ts`
- `apps/worker/src/modules/sync/service.ts` (2 lokasi)
- `apps/mcp-server/src/lib/sync-snapshot.ts`
- `apps/mcp-server/src/app/api/mcp/route.ts` (tool `create_account`/`update_account`)

### 5.4 CHECK constraint SQL

- `apps/desktop/src-tauri/migrations/0013_account_type.sql`
- `apps/desktop/src-tauri/migrations/0009_enforce_fk_set_null.sql` (hasil rebuild)
- `apps/worker/schema/0001_initial.sql`

**Total 20+ titik unik** di 3 aplikasi yang perlu ditinjau ulang satu
per satu begitu tipe baru (`investment`, `third_party`, `valas`)
ditambahkan — tidak ada satu titik kontrol terpusat.

---

## 6. Konsistensi desktop vs Worker/MCP — TIDAK PARALEL

- **Worker tidak punya controller/router `debts` sendiri** (`apps/worker/src/modules/debts/`
  cuma berisi `service.ts`) — satu-satunya cara `debts` tercipta di
  Worker adalah lewat `applyDebtTransaction` yang dipicu transfer
  transaksi, yang SELALU mengisi `account_id` dari akun transfer yang
  valid.
- `apps/worker/src/modules/debts/service.ts` (`detachDebtForDeletedTransaction`)
  adalah port "PERSIS" dari versi desktop — keduanya konsisten satu
  sama lain (cuma `transaction_id` yang di-NULL-kan saat delete, bukan
  `account_id`) — ini bagian yang SUDAH align.
- **Tapi**: fitur "mode direct"/"non_cash settlement" (temuan #1.1)
  HANYA ada di desktop. Tidak ada tool MCP setara (misal
  "create_debt_direct"/"pay_debt_non_cash") yang meniru jalur ini dari
  sisi cloud/HP. MCP `create_transaction` cuma satu pintu: `type=transfer`
  + `debtAction`.
- Belum diverifikasi mendalam: apakah baris `debts` hasil "mode direct"
  ikut ter-push ke Worker lewat `push-row.ts`, dan kalau iya apakah
  Worker-side bisa menampungnya dengan benar (field `account_id`/
  `transaction_id` NULL) — **perlu dicek di sesi solusi nanti**.

---

## 7. Skema SQL vs kode TS — KONSISTEN, tidak ada kontradiksi

- `debts.account_id`, `debt_payments.account_id`, `transactions.account_id`,
  `transactions.transfer_account_id` — semuanya nullable di skema SQL
  sejak awal (SQLite desktop maupun D1 Worker), BUKAN NOT NULL. Kode TS
  yang insert NULL (temuan #1) konsisten dengan skema — SQL tidak
  pernah melarangnya.
- Union CHECK `account_type IN ('cash', 'debt')` identik antara
  `apps/desktop/src-tauri/migrations/0013_account_type.sql` dan
  `apps/worker/schema/0001_initial.sql` — tidak ada drift.

**Catatan penting**: karena skema SQL memang mengizinkan NULL sejak
desain awal (bukan sekadar sisa `ON DELETE SET NULL`), kode TS yang
insert NULL secara sengaja TIDAK melanggar skema — tapi tetap
melanggar *prinsip konsep* yang baru dirumuskan belakangan. Ini
memperkuat kenapa gap-nya baru ketahuan sekarang: tidak ada error/
constraint yang pernah menolaknya secara teknis.

---

## Keputusan & eksekusi (2026-10-03, sesi lanjutan)

Pertanyaan asli dipertahankan sebagai konteks, diikuti keputusan user
dan apa yang dieksekusi. Commit: `572ff59` ("Fix kode yang menyimpang
dengan konsep tipe akun").

1. **Fitur "mode direct" (temuan #1.1)** — *Dipertahankan dengan
   "rumah": `debts.account_id` wajib akun bertipe `debt` (satu akun
   debt general, tidak per-kontak), `transaction_id` tetap NULL.*
   Migrasi `0031_seed_default_debt_account.sql` (seed akun debt default
   + backfill baris lama `source='manual'`). Schema/form/mutation
   desktop (`new-debt-form`, `pay-debt-form`) diubah agar `account_id`
   terisi, bukan NULL.
2. **Sync Retailku (temuan #1.2)** — **DI-SKIP**, dianggap lebih dalam
   dari perkiraan awal (keputusan user eksplisit: "kita skip dulu").
   Baris `debts`/`debt_payments` dari `source='retailku_sync'` TETAP
   boleh `account_id` NULL — belum diselaraskan. Dipisah jadi dokumen
   tersendiri utk sesi audit integrasi Retailku berikutnya:
   [apps/desktop/docs/todos/plan/retailku-sync-account-type-gap.md](../../../apps/desktop/docs/todos/plan/retailku-sync-account-type-gap.md).
3. **`accountId` opsional di MCP (temuan #1.3)** — *Disamakan wajib.*
   `isValidAccountFields` baru di `apps/worker/src/modules/transactions/schema.ts`
   (satu titik kontrol, berlaku utk PC push maupun MCP) + Zod MCP
   `accountId` tidak lagi `.optional()`.
4. **Asumsi biner cash/debt (temuan #2)** — *Direfactor sekarang.*
   `classifyAccountPair` baru (`apps/desktop/src/shared/debts/classify-account-pair.ts`
   + port Worker `apps/worker/src/modules/debts/classify-account-pair.ts`)
   — throw `UnsupportedAccountPairError` utk kombinasi di luar
   cash/debt (fail-loud SEBELUM transaksi tersimpan), bukan diam-diam
   di-no-op-kan. Juga menemukan & memperbaiki bug serupa di
   `needsDebtAction` (use-transaction-debt-fields.ts) yang TIDAK ada di
   audit awal.
5. **Guard "tipe terkunci setelah dipakai" (temuan #3)** — *Kombinasi:
   Worker sebagai penjaga keras + desktop form sebagai UX.* Definisi
   "dipakai" = ada baris tidak terhapus di `transactions`
   (account_id/transfer_account_id), `debts`, atau `debt_payments` —
   `retailku_sync_field_mapping` SENGAJA dikecualikan (konfigurasi,
   bukan histori transaksi). `isAccountInUse` di
   `apps/worker/src/modules/accounts/service.ts` (reject 422), port
   sama di desktop (`is-account-in-use.ts`) + field `account_type`
   di-disable di form edit.
6. **Peta 20+ lokasi hardcoded (temuan #5)** — *Disentralisasi per-app*
   (bukan shared package lintas-app — itu perubahan infrastruktur besar
   di luar scope). File baru: `apps/desktop/src/lib/account-types.ts`,
   `apps/worker/src/shared/account-types.ts`,
   `apps/mcp-server/src/lib/account-types.ts` — masing-masing jadi
   satu-satunya tempat `AccountType`/`ACCOUNT_TYPES` didefinisikan di
   app itu. CHECK constraint SQL (3 lokasi) SENGAJA tidak disentralisasi
   — tipe baru tetap butuh migrasi sendiri.
7. **Paralelitas desktop vs Worker/MCP (temuan #6)** — *Ditutup
   sekarang.* Modul `debts` Worker (sebelumnya cuma `service.ts`)
   ditambah `schema.ts`, `controller.ts`, `router.ts` — endpoint baru
   `POST /debts` (mode direct) dan `POST /debts/:id/payments`
   (settlement non-cash). Tool MCP baru: `create_debt_direct`,
   `pay_debt_non_cash`. Mode "transfer"/settlement "cash" SENGAJA tidak
   diduplikasi — sudah bisa lewat `POST /transactions` + `debtAction`.

**Terverifikasi**: type-check bersih di 3 app, 172 test desktop lolos
(termasuk test baru utk kombinasi tipe akun fiktif "investment"), dan
manual end-to-end test lewat `wrangler dev`/`tauri dev` utk tiap poin
(detail ada di histori percakapan sesi ini, tidak diulang di sini).

**Sisa utk sesi berikutnya**: pertanyaan #2 (sync Retailku) belum
dijawab — lihat dokumen tersendiri
[apps/desktop/docs/todos/plan/retailku-sync-account-type-gap.md](../../../apps/desktop/docs/todos/plan/retailku-sync-account-type-gap.md).

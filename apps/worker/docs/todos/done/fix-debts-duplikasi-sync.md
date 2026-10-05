# Fix: Worker berhenti auto-derive `debts`/`debt_payments` untuk transaksi PC

Index lintas-app:
[`docs/todos/done/fix-debts-duplikasi-sync.md`](../../../../../docs/todos/done/fix-debts-duplikasi-sync.md).
Detail desktop:
[`apps/desktop/docs/todos/done/fix-debts-duplikasi-sync.md`](../../../../desktop/docs/todos/done/fix-debts-duplikasi-sync.md).

## Status & TODO saat ini (ringkas)

- [x] Tambah syarat `syncSource !== 'pc'` sebelum `applyDebtTransaction`
      dipanggil di `createTransactionRow` (create).
- [x] Tambah syarat yang sama di `updateTransactionRow` sebelum bagian
      TULIS dipanggil (edit) — diimplementasi via split fungsi:
      `checkDebtEditAllowed` (precheck read-only, SELALU jalan apa pun
      `syncSource`) + `applyDebtEditAction` (bagian tulis, dikondisikan
      `syncSource !== 'pc'`). `applyDebtTransactionEdit` lama dipecah
      jadi dua fungsi ini, tidak ada lagi fungsi gabungan read+write.
- [x] Buat fungsi baru `pushDebtFromPc`/`pushDebtPaymentFromPc` di
      `debts/service.ts` — upsert-by-id MURNI, TIDAK membuat
      transaksi closing (beda dari `createDirectDebt`).
- [x] Buat endpoint baru `POST /debts/push` dan
      `POST /debts/payments/push` — controller
      (`handlePostDebtPush`/`handlePostDebtPaymentPush`) + schema
      validator baru (`isPushDebtPayload`/`isPushDebtPaymentPayload`),
      BUKAN reuse `POST /debts` yang sudah ada.
- [x] `GET /sync` (pull) — tidak diubah, sesuai rencana.
- [x] **Gap ditemukan & ditutup (2026-10-05, test manual)**: endpoint
      baru `DELETE /debts/push/:id` dan `DELETE /debts/payments/push/:id`
      (`handleDeleteDebtPush`/`handleDeleteDebtPaymentPush` di
      `controller.ts`, `deletePushedDebt`/`deletePushedDebtPayment` di
      `service.ts`) — soft-delete murni TANPA efek samping (beda dari
      `detachDebtForDeletedTransaction` yg khusus delete TRANSAKSI).
      Dibutuhkan krn saat desktop RECREATE baris (edit field berbahaya:
      hapus lama, insert baru dgn id BERBEDA), `/debts/push` yg cuma
      upsert-by-id TIDAK PERNAH tahu id LAMA harus dihapus — tanpa
      endpoint ini baris lama menumpuk selamanya di D1. Lihat detail
      gap di bagian "Gap ditemukan saat test manual" di bawah.
- [x] Test lokal via `wrangler dev` (D1 lokal) SELESAI — direplikasi via
      `tauri dev` + `wrangler dev` sungguhan (bukan simulasi): transfer
      cash→debt baru (1 baris `debts`, bukan 2), edit nominal 2x
      berturut-turut (precheck `checkDebtEditAllowed` lolos, recreate
      delete+insert, `DELETE /debts/push/:id` 200 OK, net pertambahan
      baris AKTIF per edit = 0). Dibuktikan via query
      `wrangler d1 execute --local` langsung, bukan cuma toast UI.

## Gap ditemukan saat test manual (2026-10-05)

Rencana awal fix cuma mencakup PUSH baris baru (`/debts/push`) — TIDAK
mencakup kasus desktop men-DELETE baris lama saat RECREATE (edit field
berbahaya pada transaksi `role: 'principal'` tanpa cicilan, atau
`role: 'payment'` apa pun — lihat `applyDebtTransactionEdit` lokal).
Ditemukan lewat test manual: edit nominal transaksi test 2x berturut
menghasilkan baris `debts` MENUMPUK di D1 (bukan ter-replace), karena
`pushDebtFromPc` cuma tahu cara upsert id yg DIKIRIM, tidak pernah
diberitahu id mana yg sudah tidak dipakai lagi di desktop.

**Fix**: endpoint `DELETE /debts/push/:id` + `DELETE /debts/payments/push/:id`
baru (lihat checklist di atas), dipanggil desktop via `pushDeleteOnWrite`
tiap kali `applyDebtTransactionEdit` lokal men-DELETE baris lama (detail
sisi desktop: `apps/desktop/docs/todos/done/fix-debts-duplikasi-sync.md`).
Diverifikasi via `wrangler d1 execute --local` langsung: baris lama
`deleted_at` terisi, jumlah baris AKTIF (`deleted_at IS NULL`) per
`transaction_id` tetap 1 setelah edit berulang.

**Data kotor sisa testing** (BUKAN bug baru, sisa dari 2-3 edit yg
terjadi SEBELUM fix DELETE ini ter-load — datanya sudah hilang di
desktop lokal saat itu, jadi tidak ada lagi kesempatan memberi tahu
Worker id mana yg harus dihapus): beberapa baris `debts` di D1 LOKAL
(`wrangler dev`) utk transaksi test tertinggal aktif walau sudah tidak
relevan. Tidak mempengaruhi D1 PRODUCTION (test ini semua di D1 lokal).
Dibersihkan manual kalau perlu, atau diabaikan (D1 lokal `wrangler dev`
cuma environment test, bukan data riil).

## Kenapa ini — ringkas (detail lengkap di dogfooding doc)

`debts`/`debt_payments` saat ini diturunkan OTOMATIS dari transaksi
transfer cash↔debt di DUA tempat independen: desktop (lokal, SEBELUM
push) dan Worker (`applyDebtTransaction`/`applyDebtTransactionEdit` di
`debts/service.ts`, dipanggil dari `transactions/service.ts`). Karena
`debts`/`debt_payments` tidak pernah ter-push balik dari desktop
(tidak ada di `cloud_sync_queue`), dan Worker tidak tahu desktop sudah
bikin baris sendiri, keduanya berakhir sbg 2 baris berbeda utk 1
transaksi yang sama.

**Keputusan**: source-based ownership. PC jadi pemilik derivasi
`debts`/`debt_payments` utk transaksi `syncSource==='pc'` (desktop
push baris yg SUDAH ia buat, id dipakai apa adanya). Worker TETAP jadi
pemilik utk transaksi `syncSource==='mcp'` (tidak ada PC lokal yg
terlibat sama sekali di jalur ini — tidak berubah).

**REVISI keputusan lama**: [`apps/worker/docs/todos/done/cloud-sync.md`](../done/cloud-sync.md)
dan [`docs/todos/done/cloud-sync-mcp.md`](../../../../../docs/todos/done/cloud-sync-mcp.md)
pernah menyatakan "Worker satu-satunya penulis D1" dan SENGAJA skip
endpoint push `/debts` langsung karena dianggap "tidak py padanan
create/update di desktop" — asumsi itu SALAH, desktop selalu py
`apply-debt-transaction.ts` lokalnya sendiri, independen dari
keputusan itu. Fix ini membalik keputusan tsb SECARA SADAR (lihat
catatan revisi yang ditambahkan ke kedua dokumen `done/` itu).

## Titik perubahan kode (hasil riset persis path:line)

### 1. `transactions/service.ts` — create

`apps/worker/src/modules/transactions/service.ts:210-223`, dalam
`createTransactionRow` (scope py `syncSource` sbg parameter fungsi,
baris 142):

```ts
// SEBELUM
if (payload.type === "transfer" && payload.accountId) {
  await applyDebtTransaction(env, { ... });
}

// SESUDAH
if (payload.type === "transfer" && payload.accountId && syncSource !== "pc") {
  await applyDebtTransaction(env, { ... });
}
```

### 2. `transactions/service.ts` — update

`apps/worker/src/modules/transactions/service.ts:350-356` (precheck
`getTransactionDebtStatus` + `DebtEditBlockedError`) dan `392-413`
(`applyDebtTransactionEdit` call), dalam `updateTransactionRow` (scope
py `syncSource`, baris 304-310).

**Kasus khusus: precheck edit — SELESAI, opsi (a) dipilih.** Precheck
`debtStatus.role === 'principal' && fieldsChanged && debtStatus.hasPayments`
ADA GUNANYA walau utk transaksi PC — kalau desktop (via jalur barunya
sendiri) coba push edit yg melanggar aturan ini, Worker tetap perlu
MENOLAK update `transactions`-nya (bukan cuma skip derivasi `debts`).

Diimplementasi dgn split `applyDebtTransactionEdit` jadi 2 fungsi
(`debts/service.ts`):
- `checkDebtEditAllowed(status, dangerousFieldsChanged)` — murni baca
  keputusan (tidak query DB lagi, terima `status` yg sudah di-resolve
  caller), throw `DebtEditBlockedError` kalau harus ditolak. Dipanggil
  dari `updateTransactionRow` SEBELUM UPDATE baris `transactions`,
  UNCONDITIONAL (semua `syncSource`).
- `applyDebtEditAction(env, input)` — bagian TULIS (insert/update/delete
  baris `debts`/`debt_payments`), signature sama seperti
  `applyDebtTransactionEdit` lama tapi TIDAK lagi bisa throw
  `DebtEditBlockedError` (precheck sudah lolos di caller). Dipanggil
  SETELAH UPDATE baris `transactions`, DIKONDISIKAN `syncSource !== 'pc'`.

### 3. `debts/service.ts` — fungsi baru, BUKAN reuse `createDirectDebt`

`createDirectDebt` (`apps/worker/src/modules/debts/service.ts:483-561`)
TIDAK COCOK dipakai ulang: path INSERT-nya (530-537) SELALU membuat
transaksi closing baru lewat `createDebtClosingTransaction` — salah
utk kasus kita (baris `debts` dari PC SUDAH py `transaction_id`
existing, yaitu transaksi transfer itu sendiri, JANGAN dibuatkan
transaksi closing kedua).

Fungsi baru (nama sementara `pushDebtFromPc`) perlu: LWW compare
`updated_at` (pola sama persis `createDirectDebt` baris 488-494), lalu
INSERT/UPDATE MURNI pakai field dari payload APA ADANYA (termasuk
`id`, `transactionId`) — TANPA cabang `createDebtClosingTransaction`
sama sekali. Sejajar `pushDebtPaymentFromPc` utk `debt_payments`
(struktur identik, lihat skema tabel di kedua sisi — paralel 1:1).

### 4. Endpoint baru

`apps/worker/src/modules/debts/router.ts` — tambah:
```ts
debtsRouter.post("/push", handlePostDebtPush);
```
(path disarankan, boleh disesuaikan saat implementasi — yang penting
BUKAN `POST /debts` polos yang sudah dipakai `createDirectDebt`).
Controller baru di `debts/controller.ts`, schema validator baru
(`isPushDebtPayload`) di `debts/schema.ts` — payload WAJIB bawa `id`
dan `transactionId` sbg field wajib (bukan opsional), beda dari
`CreateDirectDebtPayload` yang `transactionId`-nya didapat dari hasil
`createDebtClosingTransaction` internal.

Sejajar endpoint `POST /debt-payments/push` di modul yang sesuai utk
`debt_payments`.

## Yang TIDAK berubah

- `GET /sync` (pull) — tidak perlu modifikasi kode, behavior berubah
  otomatis begitu Worker berhenti men-derive `debts` utk transaksi PC.
- Endpoint `/debts` (`createDirectDebt`), `/debts/:id/payments`
  (`createNonCashPayment`), `/debts/:id/write-off` (`writeOffDebt`) —
  TIDAK berubah, tetap dipakai MCP (`create_debt_direct`, dll) seperti
  sekarang, scope-nya "piutang/utang TANPA transaksi existing" yang
  beda total dari kasus push PC.
- Jalur MCP (`syncSource === 'mcp'`) — tidak ada perubahan perilaku
  sama sekali, Worker tetap satu-satunya penulis utk jalur ini.

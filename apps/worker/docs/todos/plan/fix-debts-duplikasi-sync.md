# Fix: Worker berhenti auto-derive `debts`/`debt_payments` untuk transaksi PC

Index lintas-app:
[`docs/todos/plan/fix-debts-duplikasi-sync.md`](../../../../docs/todos/plan/fix-debts-duplikasi-sync.md).
Detail desktop:
[`apps/desktop/docs/todos/plan/fix-debts-duplikasi-sync.md`](../../../desktop/docs/todos/plan/fix-debts-duplikasi-sync.md).

## Status & TODO saat ini (ringkas)

- [ ] Tambah syarat `syncSource !== 'pc'` sebelum `applyDebtTransaction`
      dipanggil di `createTransactionRow` (create).
- [ ] Tambah syarat yang sama di `updateTransactionRow` sebelum
      `applyDebtTransactionEdit` dipanggil (edit) — perlu desain
      precheck `DebtEditBlockedError` tetap jalan READ-ONLY utk
      transaksi PC (lihat "Kasus khusus: precheck edit" di bawah).
- [ ] Buat fungsi baru `pushDebtFromPc`/`pushDebtPaymentFromPc` di
      `debts/service.ts` — upsert-by-id MURNI, TIDAK boleh membuat
      transaksi closing (beda dari `createDirectDebt`).
- [ ] Buat endpoint baru `POST /debts/push` dan
      `POST /debt-payments/push` (nama bisa disesuaikan) — controller +
      schema validator baru, BUKAN reuse `POST /debts` yang sudah ada.
- [ ] Verifikasi `GET /sync` (pull) tidak perlu berubah — begitu Worker
      berhenti men-derive `debts` untuk transaksi `syncSource==='pc'`,
      response pull otomatis tidak lagi membawa balik baris yang dulu
      bikin duplikat (behavior berubah TANPA ubah kode pull).
- [ ] Test lokal via `wrangler dev` (D1 lokal) sebelum deploy — replikasi
      skenario: push transaksi transfer cash→debt dgn token PC, pastikan
      TIDAK ada baris `debts` baru di D1 kecuali lewat endpoint push
      baru.

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
dan [`docs/todos/done/cloud-sync-mcp.md`](../../../../docs/todos/done/cloud-sync-mcp.md)
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

**Kasus khusus: precheck edit.** Precheck `debtStatus.role ===
'principal' && fieldsChanged && debtStatus.hasPayments` (350-356) ADA
GUNANYA walau utk transaksi PC — kalau desktop (via jalur barunya
sendiri) coba push edit yg melanggar aturan ini, Worker tetap perlu
MENOLAK update `transactions`-nya (bukan cuma skip derivasi `debts`).
Jadi precheck READ (baca status, tolak kalau perlu) TETAP jalan utk
semua `syncSource` — yang DIKONDISIKAN `syncSource !== 'pc'` HANYA
bagian TULIS (`applyDebtTransactionEdit` yang insert/update/delete
baris `debts`/`debt_payments`). Perlu dipecah: fungsi existing
`applyDebtTransactionEdit` saat ini menggabungkan read+write dalam 1
pemanggilan — opsi: (a) split jadi precheck-only + apply-only, atau
(b) wrap SELURUH call tapi pastikan precheck blocking (350-356, yang
SUDAH baca status SEBELUM applyDebtTransactionEdit) tetap jalan
independen di luar kondisi `syncSource`.

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

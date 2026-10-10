# worker-client

Client fetch untuk `apps/worker` (Cloudflare) — fondasi Tahap 6, lihat `docs/todos/plan/mcp-server-cloud-mirror.md`. Murni wrapper HTTP tipis: tidak tahu kapan dipanggil (itu urusan `shared/cloud-sync/push-on-write/` / `shared/cloud-sync/use-pull-sync/`), cuma tahu BAGAIMANA memanggil endpoint Worker dengan benar (payload camelCase, auth header, error handling).

Semua fungsi terima `{ workerUrl, token }` eksplisit (BUKAN baca dari `useCloudSyncSettings` sendiri) — modul ini tetap murni/testable tanpa bergantung ke React Query/SQLite, caller yang bertanggung jawab resolve kredensial dulu.

## `request.ts` / `worker-request-error.ts`

Inti HTTP: tambah header auth, lempar `WorkerRequestError` kalau response bukan `ok`.

## `test-cloud-sync-connection.ts`

Dipakai tombol "Tes Koneksi" — panggil `/health` (TANPA auth di sisi Worker, tapi di sini tetap kirim token biar sekalian ketahuan kalau token salah dari endpoint lain nanti). Return `true`/`false`, TIDAK throw, supaya UI caller bisa render pesan generik "berhasil"/"gagal" tanpa try/catch berlapis.

## Push: UPSERT 1 baris per panggilan, LWW via `updatedAt`

Bentuk payload SAMA PERSIS dengan kontrak Worker (lihat `apps/worker/src/modules/*/schema.ts`) — field camelCase, `updatedAt` opsional format "YYYY-MM-DD HH:mm:ss" (lihat `shared/lww.ts` Worker). `push-upsert.ts` adalah helper generik; satu file per tabel (`push-transaction.ts`, `push-account.ts`, dst) cuma beda path endpoint + shape payload.

### `push-transaction.ts`

Field `source`/`sourceRef` (provenance baris) WAJIB ikut supaya baris hasil sync Retailku tidak jatuh jadi `'manual'` di D1.

### `push-debt.ts` / `push-debt-payment.ts`

Push baris `debts`/`debt_payments` yang PC SUDAH buat sendiri lewat `apply-debt-transaction.ts` lokal (source-based ownership, lihat `docs/todos/plan/fix-debts-duplikasi-sync.md`) — upsert-by-id MURNI, endpoint TERPISAH dari `createDirectDebt`/`createNonCashPayment` (yang servernya sendiri bikin transaksi closing baru, salah untuk kasus ini karena `transactionId` SUDAH ada).

### `push-investment-account.ts` / `push-investment-purchase.ts` / `push-investment-sale.ts`

Push baris `investment_accounts`/`investment_purchases`/`investment_sales` yang PC SUDAH buat sendiri lewat `apply-investment-transaction.ts`/`apply-sell-investment-transaction.ts` lokal — upsert-by-id MURNI, pola PERSIS `push-debt.ts`/`push-debt-payment.ts` (lihat `apps/worker/src/modules/investments/schema.ts`).

## Labels: dictionary + attach/detach

Lihat `apps/worker/src/modules/labels/*` dan `docs/todos/plan/general-label.md`. BEDA dari `push-upsert.ts` generik — attach/detach butuh `entityId` di PATH (bukan cuma body), jadi fungsi sendiri bukan reuse `pushUpsert`.

`LabelScope` (`label-scope.ts`, kolom `labels.scope`) BEDA dari `LabelEntityScope` (`label-entity-scope.ts`, nama segmen PATH endpoint attach) — dua hal yang mirip namanya tapi beda makna, jangan ditukar.

### `detach-label-cloud.ts`

Detach TIDAK punya bentuk LWW upsert (tidak ada `updatedAt` yang dikirim) — endpoint Worker `DELETE /labels/:scope/:entityId/:labelId` langsung soft-delete baris junction tanpa pembanding timestamp, pola sama `delete-cloud-row.ts` generik tapi path-nya 3 segment (bukan 1 `:id`).

## Attachments: upload/download binary via R2

Lihat `apps/worker/docs/todos/plan/attachment-r2-sync.md` + `modules/attachments/*` (Worker). BEDA dari `push-upsert.ts` generik — body `multipart/form-data` (file binary + field), bukan JSON, jadi `push-attachment.ts` TIDAK reuse `request()` yang hardcode `Content-Type: application/json`.

### `list-attachments-since.ts`

`since` null -> first sync, Worker balas semua baris (termasuk yang `deletedAt` terisi). Cuma metadata — bytes diambil terpisah per baris via `get-attachment-bytes.ts`, lihat `shared/cloud-sync/pull-attachments/README.md`. `checkpoint` dipakai caller sebagai `?since=` pull berikutnya (simpan via `useSetAttachmentsCheckpoint`), SAMA pola dengan `pull-sync.ts`.

### `get-attachment-bytes.ts`

Download isi file dari R2 (lewat Worker) — dipakai pull untuk menyimpan ke disk lokal via `save_attachment_bytes` (Rust).

## `pull-sync.ts`: `GET /sync?since=`

Bentuk `SyncResponse` SAMA PERSIS dengan `apps/worker/src/modules/sync/service.ts` — camelCase, termasuk baris `deletedAt` terisi.

`investmentAccounts` ber-PK `account_id`, bukan `id` — jadi BUKAN `SyncRow` (yang mewajibkan `id`). Lihat juga `shared/cloud-sync/pull-sync/README.md` untuk cara desktop menerapkan response ini.

`since` null/undefined -> first sync, Worker balas full snapshot. Lihat `apps/worker/docs/todos/plan/cloud-sync.md` untuk kontrak lengkap.

## `delete-cloud-row.ts`: soft-delete 1 baris di Worker (`DELETE /:path/:id`)

Payload action EKSPLISIT per relasi, PERSIS pola desktop lokal (lihat `use-delete-account-group.ts`/`use-delete-account.ts`/`use-delete-category.ts`) — `contacts` TANPA payload sama sekali (desktop tidak punya reassign/unassign di sana). `transactions` JUGA tanpa payload (beda dari 3 tabel awal: tindakan terhadap debt/debt_payments terkait TUNGGAL per role, TIDAK ada pilihan dari client — lihat `delete-transaction-cloud.ts` untuk fungsi terpisah karena punya bentuk response beda, bukan void).

Soft-delete baris `debts`/`debt_payments` yang PC hapus lokal sebagai bagian dari RECREATE (`applyDebtTransactionEdit`: field berbahaya berubah -> hapus lama, insert baru dengan id BARU) — TANPA payload (beda skenario dari delete transaksi, lihat `deletePushedDebt` di Worker `service.ts`).

Sejajar untuk `investment_purchases`/`investment_sales` (RECREATE via `applyInvestmentTransactionEdit`/`applySellInvestmentTransactionEdit` lokal). `investment_accounts` TIDAK perlu entry di sini — baris itu TIDAK PERNAH direcreate (1:1 dengan `accounts`, dihapus hanya lewat `DELETE /accounts` yang Worker tangani via CASCADE di D1, bukan jalur push desktop).

`transaction_attachments`: hard-delete object R2 + soft-delete row D1 sekaligus di sisi Worker (lihat `apps/worker/src/modules/attachments/service.ts` `deleteAttachment`) — TANPA payload action sama sekali, sama bentuknya dengan `contacts`/`transactions` di atas.

## `delete-transaction-cloud.ts`

`debtInfo` SAMA PERSIS bentuknya dengan `DeletedTransactionDebtInfo` di `apps/worker/src/modules/debts/service.ts` — dipakai dialog PC untuk pesan informatif SETELAH delete berhasil (bukan "cek dulu baru hapus" 2 round-trip, keputusan 2026-10-03 lihat `cloud-sync.md`).

Terpisah dari `delete-cloud-row.ts` karena punya bentuk response beda (bukan void) — endpoint Worker `/transactions/:id` balas `{status, id, debtInfo}`, PC butuh `debtInfo` itu untuk toast informatif.

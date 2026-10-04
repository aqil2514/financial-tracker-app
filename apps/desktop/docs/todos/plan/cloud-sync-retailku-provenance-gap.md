# Cloud Sync — Jalur Retailku Belum Ikut Ter-sync (`source`/`source_ref`)

## Latar belakang

Dicatat di `Catatan Penggunaan.txt`: "Di sinkronisasi, kayaknya jalur
Retailku masih belum". Diverifikasi 2026-10-02 dgn baca kode langsung
(bukan asumsi) -- **klaim benar**, ada gap konkret, bukan cuma
perasaan.

Penting dibedakan dulu, ada 2 "Retailku" yang TIDAK saling terkait di
repo ini:

1. **Retailku -> Desktop sync** (`apps/desktop/src/features/retailku/**`)
   -- satu-arah, tarik data cashflow DARI POS Retailku KE SQLite lokal.
   Ini SUDAH matang, ada docs+test, status "done" di beberapa
   `docs/todos/done/retailku-*.md`. **BUKAN bagian yang bermasalah.**
2. **Desktop <-> Worker <-> D1 cloud sync**
   (`apps/worker`, `apps/desktop/src/shared/cloud-sync/**`) -- sync PC
   ke cloud (dan antar PC lewat cloud). **Di SINI gap-nya**, karena
   catatan "sinkronisasi" merujuk ke fitur sync yang satu ini.

## Gap konkret

Tabel `transactions` (dan jg `debts`, `debt_payments`) punya kolom
`source` (`'manual'` | `'retailku_sync'`) + `source_ref`, ditambahkan
khusus utk menandai & men-dedup baris hasil sync Retailku:

- `apps/desktop/src-tauri/migrations/0017_transaction_source.sql` --
  nambah `source`/`source_ref` + unique index di PC.
- `apps/worker/schema/0001_initial.sql` baris 90-91, 102-104, dan
  bagian serupa di `debts`/`debt_payments` -- D1 replikasi kolom yg
  SAMA, termasuk enum `retailku_sync` dan unique index.

Tapi SEPANJANG jalur cloud-sync, kolom ini tidak pernah disentuh --
selalu jatuh ke default `'manual'` / `NULL`:

1. **Push PC -> Worker**
   `apps/desktop/src/shared/cloud-sync/push-row.ts` (case
   `"transactions"`, sekitar baris 101-135) -- `SELECT` tidak ambil
   `source`/`source_ref`, dan payload yg dikirim ke `pushTransaction`
   tidak menyertakannya.
2. **Tipe payload push**
   `apps/desktop/src/shared/cloud-sync/worker-client.ts`
   (`PushTransactionPayload`) -- tidak ada field `source`/`sourceRef`
   sama sekali.
3. **Worker: schema payload masuk**
   `apps/worker/src/modules/transactions/schema.ts`
   (`PushTransactionPayload`) -- idem, tidak ada field ini, jadi
   walaupun PC kirim, Worker tidak punya tempat menampung.
4. **Worker: insert/update**
   `apps/worker/src/modules/transactions/service.ts`
   (`createTransactionRow` baris ~102-106, `updateTransactionRow`
   baris ~243-246) -- `INSERT`/`UPDATE` tidak mengisi `source`/
   `source_ref`, selalu jatuh ke default kolom `'manual'`.
5. **Pull Worker -> PC (response)**
   `apps/worker/src/modules/sync/service.ts` (`SyncResponse`,
   `getSyncSnapshot`) -- `SELECT` dan mapping utk `transactions`,
   `debts`, `debtPayments` tidak menyertakan `source`/`source_ref`.
6. **Apply pull di PC**
   `apps/desktop/src/shared/cloud-sync/pull-sync.ts`
   (`upsertTransaction` baris ~115-137, jg `upsertDebt`/
   `upsertDebtPayment`) -- `INSERT ... ON CONFLICT DO UPDATE` tidak
   menyentuh `source`/`source_ref` di kedua cabang.

Pola yg sama berlaku utk `debts` dan `debt_payments` (kolomnya ada di
D1 schema, tapi modul `debts` tidak memakainya sama sekali di push/
pull/service).

## Dampak

Transaksi hasil sync Retailku (`source='retailku_sync'`, dgn
`source_ref` utk cegah duplikat) yang lewat cloud-sync akan:

- Ter-push ke Worker **tanpa** provenance-nya -> tersimpan di D1 sbg
  `source='manual'`, `source_ref=NULL`. Identitas "ini dari Retailku"
  hilang.
- Kalau nanti ditarik balik (pull) ke PC manapun, jg tidak bisa
  direkonstruksi -- row jadi terlihat spt transaksi manual biasa.
- Unique index `source_ref` di D1 jadi tidak berguna sbg idempotency
  check utk jalur ini, krn kolomnya tidak pernah diisi lewat endpoint
  push/pull Worker.
- Potensi risiko ke depan: kalau MCP server (rencana lain, lihat
  `mcp-server-for-claude.md`) nanti menulis lewat endpoint yg sama dan
  mengandalkan `source_ref` utk idempotency, baris Retailku yg sudah
  "tercampur" sbg `manual` bisa bikin deteksi duplikat salah/tidak
  jalan.

## Yang perlu dikerjakan

- [x] Tambah `source`/`sourceRef` ke `PushTransactionPayload` di
      `worker-client.ts`, dan ke `SELECT`+payload construction di
      `push-row.ts` (case `transactions`, jg `debts`/`debt_payments`
      kalau nanti ikut di-push lewat jalur ini).
- [x] Tambah `source`/`sourceRef` ke schema payload masuk Worker
      (`apps/worker/src/modules/transactions/schema.ts`, dan modul
      `debts` kalau relevan) -- validasi enum sama dgn migrasi PC
      (`'manual'` | `'retailku_sync'`).
- [x] Worker: isi kolom `source`/`source_ref` di
      `createTransactionRow`/`updateTransactionRow`
      (`transactions/service.ts`) -- default ke `'manual'`/`NULL`
      HANYA kalau payload benar2 tidak mengirimkannya, bukan selalu.
- [x] Tambah `source`/`sourceRef` ke `SyncResponse` type +
      `getSyncSnapshot` (`SELECT` & mapping) di
      `apps/worker/src/modules/sync/service.ts`, utk `transactions`,
      `debts`, `debtPayments`.
- [x] Tambah `source`/`sourceRef` ke `upsertTransaction`/`upsertDebt`/
      `upsertDebtPayment` di `pull-sync.ts` (baik cabang INSERT maupun
      `ON CONFLICT DO UPDATE SET`).
- [ ] Verifikasi: transaksi hasil sync Retailku di PC A, push ke
      Worker, lalu pull di PC B -- pastikan `source='retailku_sync'`
      dan `source_ref` yg sama persis muncul di PC B (bukan jatuh ke
      `'manual'`).
- [ ] Verifikasi idempotency: push ulang baris yg sama (`source_ref`
      sama) tidak menghasilkan duplikat di D1 (unique index beneran
      dipakai).

## Status implementasi (2026-10-02)

Kode selesai, typecheck worker+desktop dan `vitest` hijau. Dua item
verifikasi di atas BELUM dicentang -- butuh tes manual end-to-end
(2 PC/DB + Worker live), tidak bisa dibuktikan dari unit test.

Yang dikerjakan, termasuk gap tambahan yg ketemu saat implementasi:

- **Gap tambahan: sync Retailku tidak pernah memicu push sama sekali.**
  Insert Retailku (`insert-cashflow-transaction.ts`) tidak lewat hook
  form, jadi `pushOnWrite` tidak pernah terpanggil -- baris Retailku
  cuma sampai cloud lewat backfill manual. Sekarang `syncAll()`
  memanggil `pushRetailkuSyncedTransactions()`
  (`shared/cloud-sync/push-retailku-sync.ts`) SETELAH sync sukses,
  fire-and-forget, berurutan, fallback ke antrian retry.
- Worker UPDATE hanya menimpa `source`/`source_ref` kalau payload
  EKSPLISIT kirim `source` -- penulis lain (MCP PATCH) tidak menghapus
  jejak `retailku_sync`. `sourceRef` tanpa `source` ditolak (400).
- Idempotency: bentrok `(source, source_ref)` dgn id lain -> Worker
  balas 422 `rejected` (tidak di-retry PC), bukan error constraint 500
  yg di-retry tanpa akhir. Di sisi pull PC, baris incoming yg bentrok
  dgn baris lokal (id beda) dilewati supaya pull tidak gagal total.
- `debts`/`debt_payments`: response pull sekarang bawa `source`/
  `sourceRef`, tapi cabang UPDATE di PC hanya menimpa kalau incoming
  `retailku_sync` -- debts di D1 diturunkan Worker dari transaksi
  (selalu `'manual'`), jadi tidak boleh menghapus provenance lokal.
  Push provenance debts ke Worker MASIH di luar scope (belum ada
  endpoint push debts).

## Catatan implementasi

- TIDAK perlu migrasi `.sql` baru di sisi Worker -- kolom `source`/
  `source_ref` SUDAH ada dari `0001_initial.sql` (satu-satunya file
  schema D1 sejauh ini). Ini murni gap di kode (schema TS, service,
  push/pull client), bukan di skema database.
- Kalau nanti ADA migrasi baru di `apps/desktop/src-tauri/migrations/`
  sbg bagian dari fix ini, ingat harus didaftarkan manual di
  `migrations.rs` juga (tidak auto-apply).

## Terkait

- `apps/worker/docs/todos/done/cloud-sync.md` -- rencana awal endpoint
  push/pull, checklist-nya tidak menyebut `source`/`source_ref` sama
  sekali (konsisten dgn gap ini: dari awal tidak masuk scope, bukan
  regresi).
- `docs/todos/done/retailku-cashflow-sync.md` -- fitur Retailku->Desktop
  yang menghasilkan baris `source='retailku_sync'` ini.
- `apps/desktop/docs/todos/plan/multi-device-sync-engine.md` -- rencana
  sync dua-arah yg lebih besar (device_id, change_log) -- disimpan utk
  nanti; cloud-sync yg sudah jalan sekarang (dibahas di dokumen ini)
  adalah implementasi LEBIH SEDERHANA yang sudah live duluan.
